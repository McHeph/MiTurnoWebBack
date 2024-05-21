const { transporter } = require("../config/mailer.config");
const Turn = require("../models/Turn.models");
const User = require("../models/User.models");
const BranchOffice = require("../models/BranchOffice.models");
const moment = require("moment");

class TurnsController {
  static generateTurn(req, res) {
    const currentDate = moment();
    const currentTime = moment().format("HH:mm:ss");
    const {
      appointment_date,
      appointment_time,
      branch_office_id,
      full_name,
      phone_number,
    } = req.body;
    if (
      !appointment_date ||
      !appointment_time ||
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
      moment(appointment_date).isBefore(minDate, "day") ||
      moment(appointment_date).isAfter(maxDate, "day")
    ) {
      return res.status(400).send({
        error:
          "The selected date must be within the range of up to 31 days before or after the current date",
      });
    }

    // Verifica si la fecha proporcionada no es sábado ni domingo (bloquear esos días también desde el front con el calendar)
    const dayOfWeek = moment(appointment_date).day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res
        .status(400)
        .send({ error: "The selected date is a Saturday or Sunday" });
    }

    // Verifica si la fecha proporcionada es anterior a la fecha actual (bloquear también los días anteriores a la fecha actual desde el front con el calendar)
    if (moment(appointment_date).isBefore(currentDate, "day")) {
      return res
        .status(400)
        .send({ error: "The selected date is before the current date" });
    }

    Turn.findAll({
      where: {
        user_id: req.params.user_id,
        appointment_date,
        confirmation: "pending",
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
                  appointment_time >= branch_office.opening_time &&
                  appointment_time <= adjustedClosingTime
                )
              ) {
                return res
                  .status(400)
                  .send("The turn date is outside branch office hours.");
              }
              Turn.checkTurns(
                appointment_date,
                appointment_time,
                branch_office.id
              ).then((turns) => {
                if (turns.length >= branch_office.boxes)
                  return res
                    .status(400)
                    .send(
                      "The turn on the selected day and time is no longer available."
                    );
                Turn.create({
                  appointment_date,
                  full_name,
                  phone_number,
                  appointment_time,
                  confirmation: "pending",
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
                      turn.appointment_date
                    } a las ${turn.appointment_time.slice(
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
              });
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
        confirmation: req.params.confirmation,
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
            .send("There are no turns in state: ", req.params.confirmation);
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
        confirmation: req.params.confirmation,
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
            .send("There are no turns in state: ", req.params.confirmation);
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
        confirmation: req.params.confirmation,
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
    const { confirmation } = req.body;
    Turn.update({ confirmation }, { where: { id }, returning: true })
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
    const { cancellation_reason } = req.body;

    if (!cancellation_reason)
      return res.status(400).send({
        error: "The reason for cancellation of the turn is required.",
      });

    Turn.update(
      { confirmation: "cancelled", cancellation_reason },
      { where: { id }, returning: true }
    )
      .then(([rows, turns]) => {
        User.findByPk(turns[0].user_id).then((user) => {
          const info = transporter.sendMail({
            from: '"Cancelación de turno" <turnoweb.mailing@gmail.com>',
            to: user.email,
            subject: "Cancelación de turno",
            html: `<p>Hola ${
              user.full_name
            }! Nos comunicamos de "Mi Turno Web" para confirmar que tu turno del ${
              turns[0].appointment_date
            } a las ${turns[0].appointment_time.slice(
              0,
              5
            )} fue cancelado por la siguiente razón:"${cancellation_reason}".
              Muchas gracias por confiar en nosotros!</p>`,
          });
          info.then(() => {
            res.status(200).send(turns[0]);
          });
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
          where: { branch_office_id, confirmation: "cancelled" },
        }).then((countCancel) => {
          info.total_cancelled = countCancel;
          Turn.count({
            where: { branch_office_id, confirmation: "confirmed" },
          }).then((countConfirm) => {
            info.total_confirmed = countConfirm;
            Turn.count({
              where: { branch_office_id, confirmation: "absence" },
            }).then((countAbsence) => {
              info.total_absence = countAbsence;
              Turn.count({
                where: { branch_office_id, confirmation: "pending" },
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
          let advanceDate = moment(turn.appointment_date);
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
        if (moment(turn.appointment_date).year() === currentDate.year()) {
          info[moment(turn.appointment_date).month()][turn.confirmation]++;
          info[moment(turn.appointment_date).month()].total++;
        }
      });
      res.status(200).send(info);
    });
  }
}
module.exports = TurnsController;
