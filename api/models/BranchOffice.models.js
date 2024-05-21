const Sequelize = require("sequelize");
const db = require("./db");

class BranchOffice extends Sequelize.Model {}
BranchOffice.init(
  {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    phone_number: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    boxes: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    opening_time: {
      type: Sequelize.TIME,
      allowNull: false,
    },
    closing_time: {
      type: Sequelize.TIME,
      allowNull: false,
    },
  },
  { sequelize: db, modelName: "branch_office" }
);

module.exports = BranchOffice;
