const Sequelize = require("sequelize");
const db = require("./db");

class TimeFrame extends Sequelize.Model {}

TimeFrame.init(
  {
    id: {
      type: Sequelize.TIME,
      primaryKey: true,
      unique: true,
    },
  },
  { sequelize: db, modelName: "time_frame" }
);

/* Crea los horarios por defecto al instanciar la tabla.*/
TimeFrame.sync()
  .then(() => {
    return TimeFrame.count();
  })
  .then((count) => {
    const timesToCreate = [];
    if (count === 0) {
      for (let i = 7; i <= 21; i++) {
        for (let j = 0; j <= 45; j += 15) {
          if (!(i === 7 && (j === 0 || j === 15)) && !(i === 21 && j === 45))
            timesToCreate.push({
              id: `${i < 10 ? `0${i}` : i}:${j === 0 ? `00` : j}:00`,
            });
        }
      }
      return TimeFrame.bulkCreate(timesToCreate);
    }
    return Promise.resolve(); // No es necesario devolver nada si ya hay time frames
  })
  .then(() => {
    console.log("Default times created successfully.");
  })
  .catch((error) => {
    console.error("Error creating set times:", error);
  });

module.exports = TimeFrame;
