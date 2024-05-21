const express = require("express");
const TimeFramesController = require("../controllers/timeFrames.controllers");
const { validateAuth } = require("../middlewares/validateAuth");
const router = express.Router();

router.get("/", validateAuth, TimeFramesController.allTimeFrames);
router.get(
  "/:date/:branch_office_id",
  validateAuth,
  TimeFramesController.getAvailabilityByDateAndTimeFrameBranchOffice
);

module.exports = router;
