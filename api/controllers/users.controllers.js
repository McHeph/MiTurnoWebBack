const { generateToken } = require("../config/tokens.config");
const { validateAuth } = require("../middlewares/validateAuth.js");
const { validateToken } = require("../config/tokens.config");
const { transporter } = require("../config/mailer.config");
const User = require("../models/User.models");
const { Turn, BranchOffice } = require("../models/index.models");
const { Op } = require("sequelize");

class UsersController {
  static register(req, res) {
    const { full_name, dni, email, password, phone_number } = req.body;

    if (!full_name || !dni || !email || !phone_number || !password) {
      return res.status(400).send({ error: "All fields are required!" });
    }

    User.findOne({ where: { dni } })
      .then((existingUser) => {
        if (existingUser) {
          return res.status(409).send("DNI already exists");
        }
        const payload = {
          full_name,
          email: email,
          dni: dni,
          phone_number,
          role: "customer",
        };

        const token = generateToken(payload, "10d");

        User.findOrCreate({
          where: { email },
          defaults: {
            full_name,
            dni,
            password,
            token: token,
            phone_number,
            role: "customer",
          },
        }).then((users) => {
          if (!users[1]) return res.status(409).send("Email already exists");

          //Genera el link de confirmación de cuenta y lo envía por correo
          const confirmURL = `https://miturnoweb.vercel.app/confirm-email/${token}`;
          const info = transporter.sendMail({
            from: '"Confirmación de correo electrónico" <turnoweb.mailing@gmail.com>',
            to: users[0].email,
            subject: "Confirmación de correo ✔",
            html: `<b>Por favor haz click en el siguiente link, o copia el enlace y pegalo en tu navegador para confirmar tu correo:</b><a href="${confirmURL}">${confirmURL}</a>`,
          });
          info.then(() => {
            res.status(201).send(payload);
          });
        });
      })
      .catch((error) => {
        console.error("Error when trying to register user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static login(req, res) {
    const { email, password } = req.body;

    User.findOne({ where: { email } })
      .then((user) => {
        if (!user) return res.sendStatus(401);
        user.validatePassword(password).then((isValid) => {
          if (!isValid) return res.sendStatus(401);
          if (!user.validation) return res.status(412).send("Not validated!");
          const payload = {
            id: user.id,
            full_name: user.full_name,
            dni: user.dni,
            email: user.email,
            phone_number: user.phone_number,
            role: user.role,
            branch_office_id: user.branch_office_id,
          };

          const token = generateToken(payload, "1d");

          res.cookie("token", token, {
            sameSite: "none",
            httpOnly: true,
            secure: true,
          });

          res.status(200).send(payload);
        });
      })
      .catch((error) => {
        console.error("Error when trying to login user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static validateAuthUser(req, res) {
    validateAuth(req, res, () => {
      res.status(200).send(req.user);
    });
  }

  static getSingleUser(req, res) {
    const { id } = req.params;
    Turn.findAll({
      where: {
        user_id: id,
      },
      include: { model: BranchOffice, as: "branch_office" },
    })
      .then((turns) => {
        User.findOne({ where: { id } }).then((user) => {
          if (!user) return res.sendStatus(404);
          const payload = {
            id: user.id,
            full_name: user.full_name,
            dni: user.dni,
            email: user.email,
            phone_number: user.phone_number,
            role: user.role,
            branch_office_id: user.branch_office_id,
            turns: turns,
          };
          res.status(200).send(payload);
        });
      })
      .catch((error) => {
        console.error("Error when trying to get user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static logout(req, res) {
    res.cookie("token", "", {
      sameSite: "none",
      httpOnly: true,
      secure: true,
    });
    res.status(204).send("Logged out");
  }

  static editProfile(req, res) {
    const id = req.params.user_id;

    const { full_name, dni, phone_number, branch_office_id } = req.body;

    if (!full_name || !dni || !phone_number) {
      return res.status(400).send({ error: "All fields are required!" });
    }

    User.findOne({
      where: {
        dni,
        id: {
          [Op.ne]: id,
        },
      },
    })
      .then((existingUser) => {
        if (existingUser) {
          return res.status(409).send("DNI already exists");
        }
        User.update(req.body, { where: { id }, returning: true }).then(
          ([rows, users]) => {
            const user = users[0];

            if (user.role === "operator" && !branch_office_id)
              return res
                .status(400)
                .send({ error: "All fields are required!" });

            const payload = {
              id: user.id,
              full_name: user.full_name,
              dni: user.dni,
              email: user.email,
              phone_number: user.phone_number,
              role: user.role,
              branch_office_id: user.branch_office_id,
            };

            const token = generateToken(payload, "1d");

            res.cookie("token", token, {
              sameSite: "none",
              httpOnly: true,
              secure: true,
            });

            res.status(200).send(payload);
          }
        );
      })
      .catch((error) => {
        console.error("Error when trying to update user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static editProfileFromAdmin(req, res) {
    const id = req.params.user_id;
    const { full_name, dni, phone_number, role, branch_office_id } = req.body;

    if (!full_name || !dni || !role || !phone_number || !branch_office_id) {
      return res.status(400).send({ error: "All fields are required!" });
    }

    User.findByPk(id).then((user) => {
      if (user.role === "super admin") {
        return res
          .status(401)
          .send("You cannot revoke permissions from a super administrator");
      }
    });

    User.findOne({
      where: {
        dni,
        id: {
          [Op.ne]: id,
        },
      },
    })
      .then((existingUser) => {
        if (existingUser) {
          return res.status(409).send("DNI already exists");
        }

        User.update(req.body, { where: { id }, returning: true }).then(
          ([rows, users]) => {
            const user = users[0];

            const payload = {
              id: user.id,
              full_name: user.full_name,
              dni: user.dni,
              email: user.email,
              phone_number: user.phone_number,
              role: user.role,
              branch_office_id: user.branch_office_id,
            };

            res.status(200).send(payload);
          }
        );
      })
      .catch((error) => {
        console.error("Error when trying to update user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static sendEmail(req, res) {
    const email = req.body.email;

    User.findOne({ where: { email } })
      .then((user) => {
        if (!user) return res.sendStatus(401);

        //Si el usuario existe va a generar un token
        const payload = {
          id: user.id,
          full_name: user.full_name,
          dni: user.dni,
          phone_number: user.phone_number,
          email: user.email,
        };

        const token = generateToken(payload, "10m");
        user.token = token;

        user.save().then(() => {
          //Genera el link de recuperación de contraseña y lo envía por correo
          const restorePasswordURL = `https://miturnoweb.vercel.app/new-password/${user.token}`;
          const info = transporter.sendMail({
            from: '"Recuperación de contraseña" <turnoweb.mailing@gmail.com>',
            to: user.email,
            subject: "Recuperación de contraseña ✔",
            html: `<b>Por favor haz click en el siguiente link, o copia el enlace y pegalo en tu navegador para completar el proceso:</b><a href="${restorePasswordURL}">${restorePasswordURL}</a>`,
          });
          info.then(() => {
            res.status(200).send(user.email);
          });
        });
      })
      .catch((error) => {
        console.error("Error when trying to restore password:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  /*  Una vez que el usuario recibe el correo con el link para cambiar la contraseña
  se procede a validar el token para mostrar en el front el formulario para 
  ingresar la nueva contraseña*/
  static validateTokenToRestorePassword(req, res) {
    const token = req.params.token;
    if (!token) return res.sendStatus(401);

    const { user } = validateToken(token);
    if (!user) return res.sendStatus(401);

    User.findOne({ where: { token } })
      .then((user) => {
        if (!user) return res.sendStatus(401);
        res.sendStatus(200);
      })
      .catch((error) => {
        console.error("Error when trying to validate token:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  /* En el momento en que el usuario le de click para confirmar la nueva contraseña y haya
  pasado las validaciones del front vuelve a verificar si el token sigue siendo válido o 
  si no ha expirado y luego se guarda la nueva contraseña*/
  static overwritePassword(req, res) {
    const token = req.params.token;
    if (!token) return res.sendStatus(401);

    const { user } = validateToken(token);
    if (!user) return res.sendStatus(401);
    User.findOne({ where: { token } })
      .then((user) => {
        if (!user) return res.sendStatus(401);

        user.token = null;
        user.password = req.body.password;
        user.save().then(() => {
          res.sendStatus(200);
        });
      })
      .catch((error) => {
        console.error("Error when trying to overwrite password:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static getAllUsers(req, res) {
    User.findAll({
      attributes: { exclude: ["password", "salt", "token"] },
    })
      .then((users) => {
        if (!users || users.length === 0) return res.sendStatus(404);
        return res.status(200).send(users);
      })
      .catch((error) => {
        console.error("Error getting users:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  //  Se puede promover usuario de "Cliente" a "Administrador" u "Operador" y viceversa;
  static changeRole(req, res) {
    const { user_id } = req.params;

    User.findOne({ where: { id: user_id } })
      .then((user) => {
        if (!user) return res.sendStatus(404);

        /* Un Super Administrador no se puede autorevocar su permiso*/
        if (user.role === "super admin")
          return res
            .status(400)
            .send(
              "An administrator by default cannot self-revoke a permission"
            );
      })
      .then(() => {
        // Si pasa todas las validaciones procede a promover o revocar los permisos según sea el caso
        User.update(
          { role: req.body.role },
          { where: { id: user_id }, returning: true }
        ).then(() => {
          res.status(201).send("Successful operation!");
        });
      })
      .catch((error) => {
        console.error(
          "Error when trying to promote or revoke permissions:",
          error
        );
        return res.status(500).send("Internal Server Error");
      });
  }

  static deleteUser(req, res) {
    User.findByPk(req.params.id)
      .then((user) => {
        if (user.role === "super admin") {
          return res.status(401).send("Unauthorized");
        } else {
          return User.destroy({
            where: { id: req.params.id },
          }).then((result) => {
            if (result === 0) {
              return res.status(404).send("Not found");
            } else {
              return res.status(202).send("Successful operation!");
            }
          });
        }
      })
      .catch((error) => {
        console.error("Error when trying to delete user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static registerOperator(req, res) {
    const { full_name, dni, email, password, branch_office_id, phone_number } =
      req.body;

    if (
      !full_name ||
      !dni ||
      !email ||
      !password ||
      !phone_number ||
      !branch_office_id
    ) {
      return res.status(400).send({ error: "All fields are required!" });
    }

    User.findOne({ where: { dni } })
      .then((existingUser) => {
        if (existingUser) {
          return res.status(409).send("DNI already exists");
        }
        const payload = {
          full_name,
          email,
          dni,
          phone_number,
          role: "operator",
          branch_office_id,
        };

        const token = generateToken(payload, "10d");

        User.findOrCreate({
          where: { email },
          defaults: {
            full_name,
            dni,
            password,
            token: token,
            phone_number,
            branch_office_id,
            role: "operator",
          },
        }).then((operators) => {
          if (!operators[1])
            return res.status(409).send("Email already exists");

          //Genera el link de recuperación de contraseña y lo envía por correo
          const confirmURL = `https://miturnoweb.vercel.app/confirm-email/${token}`;
          const info = transporter.sendMail({
            from: '"Confirmación de correo electrónico" <turnoweb.mailing@gmail.com>',
            to: operators[0].email,
            subject: "Confirmación de correo ✔",
            html: `<b>Por favor haz click en el siguiente link, o copia el enlace y pegalo en tu navegador para confirmar tu correo:</b><a href="${confirmURL}">${confirmURL}</a>`,
          });
          info.then(() => {
            res.status(201).send(payload);
          });
        });
      })
      .catch((error) => {
        console.error("Error when trying to register user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static getOperators(req, res) {
    User.findAll({
      where: { role: "operator" },
      attributes: { exclude: ["password", "salt", "token"] },
      include: [
        {
          model: BranchOffice,
          as: "branch_office",
        },
      ],
    })
      .then((users) => {
        if (!users) return res.status(404).send("Not found operators!");
        return res.status(200).send(users);
      })
      .catch((error) => {
        console.error("Error getting users:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static confirmEmail(req, res) {
    const { token } = req.params;

    if (!token) res.sendStatus(400);

    User.update(
      {
        validation: true,
        token: null,
      },
      { where: { token }, returning: true }
    )
      .then((user) => {
        if (!user || user.length === 0) return res.sendStatus(401);
        res.status(200).send(`Usuario ${user[1][0].id} confirmado`);
      })
      .catch((err) => {
        res.status(500).send("Error confirming user!");
      });
  }
  static changePassword(req, res) {
    const { user_id } = req.params;
    const { old_password, new_password } = req.body;

    User.findByPk(user_id)
      .then((user) => {
        if (!user) return res.sendStatus(401);
        user.validatePassword(old_password).then((isValid) => {
          if (!isValid) return res.sendStatus(401);
          user.password = new_password;
          user.save().then(() => {
            res.sendStatus(200);
          });
        });
      })
      .catch((error) => {
        console.error("Error when trying to overwrite password:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
}
module.exports = UsersController;
