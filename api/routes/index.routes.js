const express = require("express");
const router = express.Router();
const users = require("./users.routes");
const turns = require("./turns.routes");
const branchOffices = require("./branchOffices.routes");
const timeFrames = require("./timeFrames.routes");

router.use("/users", users);
router.use("/turns", turns);
router.use("/branch-offices", branchOffices);
router.use("/time-frames", timeFrames);
router.get("/ping", (req, res) => {
  res.send("PONG!");
});

module.exports = router;
