const TimeFrame = require("../models/TimeFrame.models");
const Turn = require("../models/Turn.models");
const BranchOffice = require("../models/BranchOffice.models");
const { Op } = require("sequelize");

class TimeFrameController {
  static getAvailabilityByDateAndTimeFrameBranchOffice(req, res) {
    Turn.findAll({
      where: {
        branch_office_id: req.params.branch_office_id,
        appointment_date: req.params.date,
        confirmation: "pending",
      },
    })
      .then((turns) => {
        if (!turns || turns.length === 0) {
          return BranchOffice.findByPk(req.params.branch_office_id).then(
            (branch_office) => {
              if (!branch_office) {
                return res.status(404).send("Branch Office not available");
              }

              return TimeFrame.findAll({
                where: {
                  id: {
                    [Op.between]: [
                      branch_office.opening_time,
                      branch_office.closing_time,
                    ],
                  },
                },
              }).then((timeFrames) => {
                return res.status(200).send(timeFrames);
              });
            }
          );
        }

        const turnsGroupedByAppointmentTime = turns.reduce((grouped, turn) => {
          const appointment_time = turn.appointment_time;

          if (!grouped[appointment_time]) {
            grouped[appointment_time] = [];
          }

          grouped[appointment_time].push(turn);
          return grouped;
        }, {});

        return BranchOffice.findByPk(req.params.branch_office_id).then(
          (branch_office) => {
            const unavailableTimeFrames = Object.keys(
              turnsGroupedByAppointmentTime
            ).filter(
              (appointment_time) =>
                turnsGroupedByAppointmentTime[appointment_time].length >=
                branch_office.boxes
            );

            return TimeFrame.findAll({
              where: {
                id: {
                  [Op.between]: [
                    branch_office.opening_time,
                    branch_office.closing_time,
                  ],
                  [Op.notIn]: unavailableTimeFrames,
                },
              },
            }).then((timeFrames) => {
              return res.status(200).send(timeFrames);
            });
          }
        );
      })
      .catch((error) => {
        console.error("Error when trying to get time frames:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static allTimeFrames(req, res) {
    TimeFrame.findAll({ attributes: ["id"] })
      .then((timeFrames) => {
        if (!timeFrames) return res.sendStatus(404);
        res.status(200).send(timeFrames);
      })
      .catch((error) => {
        console.error("Error getting time frames:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
}
module.exports = TimeFrameController;
