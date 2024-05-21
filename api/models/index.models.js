const User = require("./User.models");
const Turn = require("./Turn.models");
const BranchOffice = require("./BranchOffice.models");
const TimeFrame = require("./TimeFrame.models");

User.belongsTo(BranchOffice, {
  foreignKey: "branch_office_id",
  as: "branch_office",
});

Turn.belongsTo(BranchOffice, {
  foreignKey: "branch_office_id",
  as: "branch_office",
});

Turn.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

module.exports = {
  Turn,
  User,
  BranchOffice,
  TimeFrame,
};
