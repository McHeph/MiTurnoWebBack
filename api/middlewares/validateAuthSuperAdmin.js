const { validateToken } = require("../config/tokens.config");

function validateAuthSuperAdmin(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401);

  const { user } = validateToken(token);
  if (!user || user.role !== "super admin") return res.sendStatus(401);

  req.user = user;

  next();
}

module.exports = { validateAuthSuperAdmin };
