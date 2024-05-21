const Sequelize = require("sequelize");
const db = require("./db");
const BranchOffice = require("./BranchOffice.models");
const TimeFrame = require("./TimeFrame.models");
const User = require("./User.models");

class Turn extends Sequelize.Model {
  static turnsByUser(userId) {
    return Turn.findAll({
      where: {
        userId,
      },
    });
  }

  static checkTurns(appointmentDate, appointmentTime, branchOfficeId) {
    return Turn.findAll({
      where: {
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        confirmation: "pending",
        branch_office_id: branchOfficeId,
      },
    });
  }
}
Turn.init(
  {
    appointment_date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },

    reservation_date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },

    reservation_time: {
      type: Sequelize.TIME,
      allowNull: false,
    },

    confirmation: {
      type: Sequelize.ENUM("pending", "confirmed", "cancelled", "absence"),
      allowNull: false,
    },

    cancellation_reason: {
      type: Sequelize.ENUM(
        "Ya no quiero ir",
        "Me equivoqué de horario",
        "Encontré un lugar mejor",
        "Me cancelaron",
        "Otro"
      ),
      allowNull: true,
    },

    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },

    branch_office_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: BranchOffice,
        key: "id",
      },
    },

    appointment_time: {
      type: Sequelize.TIME,
      allowNull: false,
      references: {
        model: TimeFrame,
        key: "id",
      },
    },

    full_name: {
      type: Sequelize.STRING,
      allowNull: false,
    },

    phone_number: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  },
  { sequelize: db, modelName: "turn" }
);

module.exports = Turn;
