const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
require("dotenv").config();
const db = require("./models/db");
const { User, Turn, BranchOffice } = require("./models/index.models");
const routes = require("./routes/index.routes");
const path = require("path");
const fs = require("fs");
//swagger
const swaggerUI = require("swagger-ui-express");

const app = express();

// Lee el contenido del archivo swagger.json
const swaggerSpec = JSON.parse(
  fs.readFileSync(path.join(__dirname, "swagger.json"), "utf-8")
);

app.use(express.json());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    origin: "https://miturnoweb.vercel.app/",
    credentials: true,
  })
);
app.use((err, req, res, next) => {
  res.status(500).send(err);
});

app.use("/api", routes);
// Ruta para la documentación de Swagger
app.use("/api-doc", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

db.sync({ force: false }).then(() => {
  app.listen(3000, () => console.log(`Servidor  en el puerto 5001`));
});
module.exports = app;
