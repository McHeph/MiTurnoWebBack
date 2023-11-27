const { BranchOffice } = require("../models/index.models");

class BranchOfficesController {
  static create(req, res) {
    const { name, boxes, email, openingTime, closingTime } = req.body;
    if (!name || !boxes || !email || !openingTime || !closingTime) {
      return res
        .status(400)
        .send({ error: "Todos los campos son obligatorios" });
    }
    BranchOffice.create({
      name,
      boxes,
      email,
      opening_time: openingTime,
      closing_time: closingTime,
    })
      .then((branch) => {
        res.status(201).send(branch);
      })
      .catch((error) => {
        console.error("Error when trying to create branch:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static single(req, res) {
    const id = req.params.id;
    BranchOffice.findByPk(id)
      .then((branch) => {
        res.send(branch);
      })
      .catch((error) => {
        console.error("Error when trying to get branch:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static all(req, res) {
    BranchOffice.findAll()
      .then((branchArray) => {
        res.send(branchArray);
      })
      .catch((error) => {
        console.error("Error when trying to get branches:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static edit(req, res) {
    const id = req.params.id;
    BranchOffice.update(req.body, { where: { id }, returning: true })
      .then(([rows, branches]) => {
        res.send(branches[0]);
      })
      .catch((error) => {
        console.error("Error when trying to update branch:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static delete(req, res) {
    const id = req.params.id;
    BranchOffice.destroy({ where: { id } })
      .then(() => {
        res.status(200).send("Branch deleted sucsessfully");
      })
      .catch((error) => {
        console.error("Error when trying to delete branch:", error);
        return res.status(500).send("Internal Server Error");
      });
  }
  static availableDays(req, res) {
    const id = req.params.id;
    BranchOffice.findByPk(id)
      .then((branch) => {
        const openHour = parseInt(branch.opening_time.slice(0, 2));
        const openMinute = parseInt(branch.opening_time.slice(3));
        const closeHour = parseInt(branch.closing_time.slice(0, 2));
        const closeMinute = parseInt(branch.closing_time.slice(3));
        let maxTurns = (closeHour - openHour) * 4;

        if (openMinute === 15) maxTurns -= 1;
        else if (openMinute === 30) maxTurns -= 2;
        else if (openMinute === 45) maxTurns -= 3;
        if (closeMinute === 15) maxTurns += 1;
        else if (closeMinute === 30) maxTurns += 2;
        else if (closeMinute === 45) maxTurns += 3;

        maxTurns *= branch.boxes;

        console.log(maxTurns);

        res.send(branch);
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  }
}

module.exports = BranchOfficesController;
