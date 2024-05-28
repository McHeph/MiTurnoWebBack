const { Sequelize } = require("sequelize");
const db = new Sequelize(process.env.DB_CONNECTION);
module.exports = db;
