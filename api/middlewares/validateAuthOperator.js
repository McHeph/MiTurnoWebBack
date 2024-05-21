const { validateToken } = require("../config/tokens.config");

function validateAuthOperator(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401);

  const { user } = validateToken(token);
  if (
    !user ||
    (user.role !== "operator" &&
      user.role !== "admin" &&
      user.role !== "super admin")
  )
    return res.sendStatus(401);

  req.user = user;

  next();
}

module.exports = { validateAuthOperator };
