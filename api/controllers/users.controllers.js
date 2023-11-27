const { generateToken } = require("../config/tokens.config");
const { validateAuth } = require("../config/auth.config");
const { validateToken } = require("../config/tokens.config");
const { transporter } = require("../config/mailer.config");
const User = require("../models/User.models");
const Role = require("../models/Role.models");
const { Turn, BranchOffice } = require("../models/index.models");

class UsersController {
  static register(req, res) {
    const { fullName, dni, email, password, phoneNumber } = req.body;

    if (!fullName || !dni || !email || !phoneNumber || !password) {
      return res.status(400).send({ error: "All fields are required!" });
    }

    const payload = {
      fullName: fullName,
      email: email,
      dni: dni,
      phoneNumber: phoneNumber,
      roleId: "customer",
    };

    const token = generateToken(payload, "10d");

    User.findOrCreate({
      where: { email },
      defaults: {
        full_name: fullName,
        dni,
        password,
        token: token,
        phone_number: phoneNumber,
        role_id: "customer",
      },
    })
      .then((userArray) => {
        if (!userArray[1]) return res.status(409).send("Email already exists");

        //Genera el link de recuperación de contraseña y lo envía por correo
        const confirmURL = `http://localhost:3000/confirm-email/${token}`;
        const info = transporter.sendMail({
          from: '"Confirmación de correo electrónico" <turnoweb.mailing@gmail.com>',
          to: userArray[0].email,
          subject: "Confirmación de correo ✔",
          html: `<b>Por favor haz click en el siguiente link, o copia el enlace y pegalo en tu navegador para confirmar tu correo:</b><a href="${confirmURL}">${confirmURL}</a>`,
        });
        info.then(() => {
          res.status(201).send(payload);
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
          if (!user.confirmation) return res.status(412).send("Not confirmed");
          const payload = {
            id: user.id,
            fullName: user.full_name,
            dni: user.dni,
            email: user.email,
            phoneNumber: user.phone_number,
            roleId:user.role_id,
            branchOfficeId:user.branch_office_id,
          };

          const token = generateToken(payload, "1d");

          res.cookie("token", token, {
            sameSite: "none",
            httpOnly: true,
            secure: true,
          });

          res.send(payload);
        });
      })
      .catch((error) => {
        console.error("Error when trying to login user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  static validateAuthUser(req, res) {
    validateAuth(req, res, () => {
      res.send(req.user);
    });
  }

  static getSingleUser(req, res) {
    const { id } = req.params;
    Turn.findAll({
      where: {
        user_id: id,
      },
      include: { model: BranchOffice, as: "branchOffice" },
    })
      .then((turns) => {
        User.findOne({ where: { id } }).then((user) => {
          if (!user) return res.sendStatus(404);
          const payload = {
            id: user.id,
            fullName: user.full_name,
            dni: user.dni,
            email: user.email,
            phoneNumber: user.phone_number,
            roleId: user.role_id,
            branchOfficeId: user.branch_office_id,
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
    res.clearCookie("token");
    res.status(204).send("Logged out");
  }

  static editProfile(req, res) {
    const id = req.params.userId;

    User.update(req.body, { where: { id }, returning: true })
      .then(([rows, users]) => {
        const user = users[0];
        const payload = {
          id: user.id,
          fullName: user.full_name,
          dni: user.dni,
          email: user.email,
          phoneNumber: user.phone_number,
          roleId: user.role_id,
        };

        const token = generateToken(payload, "1d");

        res.cookie("token", token, {
          sameSite: "none",
          httpOnly: true,
          secure: true,
        });

        res.status(200).send(users[0]);
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
          fullName: user.full_name,
          dni: user.dni,
          phoneNumber: user.phone_number,
          email: user.email,
        };

        const token = generateToken(payload, "10m");
        user.token = token;

        user
          .save()
          .then(() => {
            //Genera el link de recuperación de contraseña y lo envía por correo
            const restorePasswordURL = `http://localhost:3000/new-password/${user.token}`;
            const info = transporter.sendMail({
              from: '"Recuperación de contraseña" <turnoweb.mailing@gmail.com>',
              to: user.email,
              subject: "Recuperación de contraseña ✔",
              html: `<b>Por favor haz click en el siguiente link, o copia el enlace y pegalo en tu navegador para completar el proceso:</b><a href="${restorePasswordURL}">${restorePasswordURL}</a>`,
            });
            info.then(() => {
              res.status(200).send(user.email);
            });
          })
          .catch((err) => {
            console.error(err);
            res.send("Something went wrong");
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
        return res.send(users);
      })
      .catch((error) => {
        console.error("Error getting users:", error);
        return res.status(500).send("Internal Server Error");
      });
  }

  //  Se puede promover usuario de "Cliente" a "Administrador" u "Operador" y viceversa;
  static promoteOrRevokePermissions(req, res) {
    const { id } = req.params.userId;

    User.findOne({ where: { id } })
      .then((user) => {
        if (!user) return res.sendStatus(404);

        /* Un Super Administrador no se puede autorevocar su permiso*/
        if (user.role_id === "Super Administrador")
          return res
            .status(400)
            .send(
              "An administrator by default cannot self-revoke a permission"
            );

        // Si pasa todas las validaciones procede a promover o revocar los permisos según sea el caso
        user.role_id = req.body.roleId;
        user.save().then(() => {
          res.status(200).send("Successful operation!");
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
    const { id } = req.params.id;
    User.destroy({
      where: { id },
    })
      .then((user) => {
        if (!user) return res.sendStatus(404);
        return res.sendStatus(202);
      })
      .catch((error) => {
        console.error("Error when trying to delete user:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static registerOperator(req, res) {
    const { fullName, dni, email, password, branchOfficeId, phoneNumber } = req.body;

    if (!fullName || !dni || !email || !password || !phoneNumber || !branchOfficeId) {
      return res.status(400).send({ error: "All fields are required!" });
    }

    const payload = {
      fullName: fullName,
      email: email,
      dni: dni,
      phoneNumber: phoneNumber,
      roleId: "operator",
      branchOfficeId: branchOfficeId,
    };

    const token = generateToken(payload, "10d");

    User.findOrCreate({
      where: { email },
      defaults: {
        full_name: fullName,
        dni,
        password,
        token: token,
        phone_number: phoneNumber,
        branch_office_id:branchOfficeId,
        role_id: "operator",
      },
    })
      .then((operatorArray) => {
        if (!operatorArray[1])
          return res.status(409).send("Email already exists");

                //Genera el link de recuperación de contraseña y lo envía por correo
                const confirmURL = `http://localhost:3000/confirm-email/${token}`;
                const info = transporter.sendMail({
                  from: '"Confirmación de correo electrónico" <turnoweb.mailing@gmail.com>',
                  to: operatorArray[0].email,
                  subject: "Confirmación de correo ✔",
                  html: `<b>Por favor haz click en el siguiente link, o copia el enlace y pegalo en tu navegador para confirmar tu correo:</b><a href="${confirmURL}">${confirmURL}</a>`,
                });
                info.then(() => {
                  res.status(201).send(payload);
                });
              })
              .catch((error) => {
                console.error("Error when trying to register user:", error);
                return res.status(500).send("Internal Server Error");
              });
  }
  static getOperators(req, res) {
    User.findAll({
      where: { role_id: "operator" },
      attributes: { exclude: ["password", "salt", "token"] },
      include: [
        {
          model: BranchOffice,
          as: "branchOffice",
        },
      ],
    })
      .then((users) => {
        if (!users || users.length === 0) return res.sendStatus(404);
        return res.send(users);
      })
      .catch((error) => {
        console.error("Error getting users:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static confirmEmail(req, res) {
    const { token } = req.params;
    User.update(
      {
        confirmation: true,
        token: null,
      },
      { where: { token }, returning: true }
    )
      .then((user) =>
        res.status(200).send(`Usuario ${user[1][0].id} confirmado`)
      )
      .catch((err) => {
        res.status(500).send("error al confirmar usuario");
      });
  }
}
module.exports = UsersController;