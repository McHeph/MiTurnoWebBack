const moment = require("moment");
const Turn = require("../models/Turn.models");

const meses31dias = ["01", "03", "05", "07", "08", "10", "12"];
const meses30dias = ["04", "06", "09", "11"];
class daysTester {
  static createDays() {
    const testDays = [];
    let date = moment().subtract(2, "days").toISOString().slice(0, 10);
    let year = parseInt(date.slice(0, 4));
    let month = parseInt(date.slice(5, 7));
    let day = parseInt(date.slice(8, 10));
    for (let i = 0; i <= 40; i++) {
      let dateString = `${year}-${month}-${day}`;
      testDays.push(dateString);
      if (meses31dias.includes(`${month < 10 ? `0${month}` : month}`)) {
        if (day === 31) {
          if (month === 12) {
            month = 1;
            year++;
          } else {
            month++;
            day = 1;
          }
        } else day++;
      } else if (meses30dias.includes(`${month < 10 ? `0${month}` : month}`)) {
        if (day === 30) {
          month++;
          day = 1;
        } else day++;
      } else {
        if (day === 29 && year === 2024) {
          month++;
          day = 1;
        } else if (day === 28 && year !== 2024) {
          month++;
          day = 1;
        } else day++;
      }
    }
    return testDays;
  }

  static createMaxTurns(branch) {
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
    return maxTurns;
  }

  static async testDays(daysArray, maxTurns, branch) {
    let unavailableDays = [];
    for (const day of daysArray) {
      await Turn.findAll({
        where: {
          appointment_date: day,
          branch_office_id: branch.id,
          confirmation: "pending",
        },
      }).then((turns) => {
        if (turns.length >= maxTurns) {
          let [year, month, newDay] = day.split("-");

          newDay++;
          if (meses31dias.includes(month)) {
            if (day === 31) {
              if (month === 12) {
                month = 1;
                year++;
              } else {
                month++;
                day = 1;
              }
            }
          } else if (meses30dias.includes(month)) {
            if (day === 30) {
              month++;
              day = 1;
            }
          } else {
            if (day === 29 && year === 2024) {
              month++;
              day = 1;
            } else if (day === 28 && year !== 2024) {
              month++;
              day = 1;
            }
          }
          unavailableDays.push(new Date(`${year}-${month}-${newDay}`));
        }
      });
    }
    return unavailableDays;
  }
}
module.exports = daysTester;
