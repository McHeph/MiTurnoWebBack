const { transporter } = require("../config/mailer.config");
const Turn = require("../models/Turn.models");
const User = require("../models/User.models");
const BranchOffice = require("../models/BranchOffice.models");
const ReasonCancellation = require("../models/ReasonCancellation.models");
const moment = require("moment");
const { Op, where } = require("sequelize");

class TurnsController {
  static generateTurn(req, res) {
    const currentDate = moment();
    const currentTime = moment().format("HH:mm:ss");
    const { turn_date, horary_id, branch_office_id, full_name, phone_number } =
      req.body;

    if (
      !turn_date ||
      !horary_id ||
      !branch_office_id ||
      !full_name ||
      !phone_number
    ) {
      return res
        .status(400)
        .send({ error: "Todos los campos son obligatorios" });
    }

    /*Para verificar o preveer que no se seleccione un día feriado hacerlo desde el calendar del front bloqueando los días feriados y que no deje escribir las fechas a mano sino que únicamente se  pueda seleccionar la fecha desde el calendar (bloquear input de fecha). */

    //Desde el front habilitar fechas en el calendar sólo en el rango de 1 mes en curso (31 días) partiendo desde currentDate. Se va habilitando una nueva fecha a mediada que pasa un día.
    /*Y desde el back hacemos también la verificación para ver si la fecha está dentro del rango de hasta
      31 días antes o después de la fecha actual*/
    const minDate = moment().subtract(31, "days");
    const maxDate = moment().add(31, "days");

    if (
      moment(turn_date).isBefore(minDate, "day") ||
      moment(turn_date).isAfter(maxDate, "day")
    ) {
      return res.status(400).send({
        error:
          "The selected date must be within the range of up to 31 days before or after the current date",
      });
    }

    // Verifica si la fecha proporcionada no es sábado ni domingo (bloquear esos días también desde el front con el calendar)
    const dayOfWeek = moment(turn_date).day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res
        .status(400)
        .send({ error: "The selected date is a Saturday or Sunday" });
    }

    // Verifica si la fecha proporcionada es anterior a la fecha actual (bloquear también los días anteriores a la fecha actual desde el front con el calendar)
    if (moment(turn_date).isBefore(currentDate, "day")) {
      return res
        .status(400)
        .send({ error: "The selected date is before the current date" });
    }

    Turn.findAll({
      where: {
        user_id: req.params.user_id,
        turn_date,
        confirmation_id: "pending",
      },
    })
      .then((turns) => {
        if (turns.length && turns.length >= 3)
          return res
            .status(409)
            .send("You cannot book more than three turn on the same day.");
        User.findByPk(req.params.user_id).then((user) => {
          BranchOffice.findByPk(req.body.branch_office_id).then(
            (branch_office) => {
              const closingTime = branch_office.closing_time;

              // Crear un objeto Date con la hora original
              const originalTime = new Date(`2000-01-01T${closingTime}`);

              // Restar 15 minutos
              originalTime.setMinutes(originalTime.getMinutes() - 15);

              // Obtener la nueva hora y minutos
              const newHour = originalTime.getHours();
              const newMinutes = originalTime.getMinutes();

              // Formatear la nueva hora y minutos en el string deseado
              const adjustedClosingTime = `${String(newHour).padStart(
                2,
                "0"
              )}:${String(newMinutes).padStart(2, "0")}:00`;

              if (
                !(
                  horary_id >= branch_office.opening_time &&
                  horary_id <= adjustedClosingTime
                )
              ) {
                return res
                  .status(400)
                  .send("The turn date is outside branch office hours.");
              }
              Turn.checkTurns(turn_date, horary_id, branch_office.id).then(
                (turns) => {
                  if (turns.length >= branch_office.boxes)
                    return res
                      .status(400)
                      .send(
                        "The turn on the selected day and time is no longer available."
                      );
                  Turn.create({
                    turn_date,
                    full_name,
                    phone_number,
                    horary_id,
                    confirmation_id: "pending",
                    reservation_date: currentDate,
                    reservation_time: currentTime,
                    branch_office_id,
                    user_id: user.id,
                  }).then((turn) => {
                    const info = transporter.sendMail({
                      from: '"Confirmación de turno" <turnoweb.mailing@gmail.com>',
                      to: user.email,
                      subject: "Confirmación de turno ✔",
                      html: `<p>Hola ${
                        user.full_name
                      }! Nos comunicamos de "Mi Turno Web" para confirmar que tu turno del ${
                        turn.turn_date
                      } a las ${turn.horary_id.slice(
                        0,
                        5
                      )} fue reservado satisfactoriamente. Te esperamos en nuestra sucursal de ${
                        branch_office.name
                      }.
                Muchas gracias por confiar en nosotros!</p>`,
                    });
                    info.then(() => {
                      res.status(201).send(turn);
                    });
                  });
                }
              );
            }
          );
        });
      })
      .catch((error) => {
        console.error("Error when trying to generate turn:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static getAllTurnsByConfirmation(req, res) {
    Turn.findAll({
      where: {
        confirmation_id: req.params.confirmation_id,
      },
      include: [
        { model: BranchOffice, as: "branch_office" },
        { model: User, as: "user", attributes: ["full_name"] },
      ],
    })
      .then((turns) => {
        if (!turns)
          return res
            .status(404)
            .send("There are no turns in state: ", req.params.confirmation_id);
        return res.status(200).send(turns);
      })
      .catch((error) => {
        console.error("Error when trying to get turns:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static getAllTurnsByConfirmationAndBranchOfficeId(req, res) {
    Turn.findAll({
      where: {
        confirmation_id: req.params.confirmation_id,
        branch_office_id: req.params.branch_office_id,
      },
      include: [
        { model: BranchOffice, as: "branch_office" },
        { model: User, as: "user", attributes: ["full_name"] },
      ],
    })
      .then((turns) => {
        if (!turns)
          return res
            .status(404)
            .send("There are no turns in state: ", req.params.confirmation_id);
        return res.status(200).send(turns);
      })
      .catch((error) => {
        console.error("Error when trying to get turns:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static getAllTurnsByConfirmationAndUser(req, res) {
    Turn.findAll({
      where: {
        confirmation_id: req.params.confirmation_id,
        user_id: req.params.user_id,
      },
      include: [{ model: BranchOffice, as: "branch_office" }],
    })
      .then((turns) => {
        if (!turns) return res.status(404).send("There are no turns");
        return res.status(200).send(turns);
      })
      .catch((error) => {
        console.error("Error when trying to get turns:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static getTurn(req, res) {
    Turn.findOne({
      where: {
        id: req.params.id,
      },
      include: { model: BranchOffice, as: "branch_office" },
    })
      .then((turn) => {
        if (!turn) return res.sendStatus(404);
        res.status(200).send(turn);
      })
      .catch((error) => {
        console.error("Error when trying to get turn:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static confirmTurn(req, res) {
    const { id } = req.params;
    const { confirmation_id } = req.body;
    Turn.update({ confirmation_id }, { where: { id }, returning: true })
      .then(([rows, turns]) => {
        res.status(200).send(turns[0]);
      })
      .catch((error) => {
        console.error("Error when trying to confirm turn:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static cancelTurn(req, res) {
    const { id } = req.params;
    const { reason_cancellation_id } = req.body;

    if (!reason_cancellation_id)
      return res.status(400).send({
        error: "The reason for cancellation of the turn is required.",
      });

    Turn.update(
      { confirmation_id: "cancelled", reason_cancellation_id },
      { where: { id }, returning: true }
    )
      .then(([rows, turns]) => {
        User.findByPk(turns[0].user_id).then((user) => {
          ReasonCancellation.findByPk(reason_cancellation_id).then(
            (reasonCancellation) => {
              const info = transporter.sendMail({
                from: '"Cancelación de turno" <turnoweb.mailing@gmail.com>',
                to: user.email,
                subject: "Cancelación de turno",
                html: `<p>Hola ${
                  user.full_name
                }! Nos comunicamos de "Mi Turno Web" para confirmar que tu turno del ${
                  turns[0].turn_date
                } a las ${turns[0].horary_id.slice(
                  0,
                  5
                )} fue cancelado por la siguiente razón:"${
                  reasonCancellation.reason
                }".
              Muchas gracias por confiar en nosotros!</p>`,
              });
              info.then(() => {
                res.status(200).send(turns[0]);
              });
            }
          );
        });
      })
      .catch((error) => {
        console.error("Error when trying to cancelled turn:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static all(req, res) {
    Turn.findAll()
      .then((turns) => {
        res.status(200).send(turns);
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  }
  static dashboardGeneral(req, res) {
    const branch_office_id = req.params.branchId;
    let info = {};
    Turn.count({ where: { branch_office_id } })
      .then((count) => {
        info.total = count;
        Turn.count({
          where: { branch_office_id, confirmation_id: "cancelled" },
        }).then((countCancel) => {
          info.total_cancelled = countCancel;
          Turn.count({
            where: { branch_office_id, confirmation_id: "confirmed" },
          }).then((countConfirm) => {
            info.total_confirmed = countConfirm;
            Turn.count({
              where: { branch_office_id, confirmation_id: "absence" },
            }).then((countAbsence) => {
              info.total_absence = countAbsence;
              Turn.count({
                where: { branch_office_id, confirmation_id: "pending" },
              }).then((countPending) => {
                info.total_pending = countPending;
                res.status(200).send(info);
              });
            });
          });
        });
      })
      .catch((err) => res.status(500).send(err));
  }
  static dashboardInAdvance(req, res) {
    const branch_office_id = req.params.branchId;
    let info = {
      advance_count: 0,
    };
    Turn.findAll({ where: { branch_office_id } })
      .then((turns) => {
        turns.map((turn) => {
          let advanceDate = moment(turn.turn_date);
          advanceDate = advanceDate.subtract(1, "w");
          if (moment(turn.reservation_date).isBefore(advanceDate)) {
            info.advance_count++;
          }
        });
        res.status(200).send(info);
      })
      .catch((err) => res.status(500).send(err));
  }
  static dashboardByTime(req, res) {
    const branch_office_id = req.params.branchId;
    const { filter } = req.body;
    let info = {
      0: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      1: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      2: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      3: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      4: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      5: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      6: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      7: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      8: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      9: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      10: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
      11: {
        pending: 0,
        absence: 0,
        total: 0,
        cancelled: 0,
        confirmed: 0,
      },
    };
    let currentDate = moment();
    Turn.findAll({ where: { branch_office_id } }).then((turns) => {
      turns.map((turn) => {
        if (moment(turn.turn_date).year() === currentDate.year()) {
          info[moment(turn.turn_date).month()][turn.confirmation_id]++;
          info[moment(turn.turn_date).month()].total++;
        }
      });
      res.status(200).send(info);
    });
  }
}
module.exports = TurnsController;
