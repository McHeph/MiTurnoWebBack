const Sequelize = require("sequelize");
const bcrypt = require("bcrypt");
const db = require("./db");
const BranchOffice = require("./BranchOffice.models");

class User extends Sequelize.Model {
  hash(password, salt) {
    return bcrypt.hash(password, salt);
  }

  validatePassword(password) {
    return this.hash(password, this.salt).then(
      (newHash) => newHash === this.password
    );
  }
}

User.init(
  {
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    salt: {
      type: Sequelize.STRING,
    },
    password: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    full_name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    role: {
      type: Sequelize.ENUM("admin", "super admin", "operator", "customer"),
      allowNull: false,
    },
    branch_office_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: BranchOffice,
        key: "id",
      },
    },
    dni: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    token: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    validation: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    phone_number: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  },
  { sequelize: db, modelName: "user" }
);

User.beforeSave((user) => {
  const salt = bcrypt.genSaltSync();

  user.salt = salt;

  return user.hash(user.password, salt).then((hash) => {
    user.password = hash;
  });
});

/* Crea los roles por defecto al instanciar la tabla.*/
User.sync()
  .then(() => {
    return User.count();
  })
  .then((count) => {
    if (count === 0) {
      const userSuperAdminToCreate = [
        {
          full_name: "Super admin",
          email: process.env.EMAIL_SUPERADMIN,
          password: "Turnoweb123456",
          role: "super admin",
          dni: "12345678",
          validation: true,
          phone_number: "2231234567",
        },
      ];
      const usersWithHashedPassword = [];
      userSuperAdminToCreate.map((user) => {
        const salt = bcrypt.genSaltSync();
        const hashedPassword = bcrypt.hashSync(user.password, salt);

        usersWithHashedPassword.push({
          ...user,
          salt: salt,
          password: hashedPassword,
        });
      });

      return User.bulkCreate(usersWithHashedPassword);
    }
    return Promise.resolve();
  })
  .then(() => {
    console.log("Default user super admin created successfully.");
  })
  .catch((error) => {
    console.error("Error creating super admin:", error);
  });

module.exports = User;
