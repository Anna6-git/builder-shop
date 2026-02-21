const db = require("./db");

db.get("PRAGMA table_info(admins)", [], (err, rows) => {
  if (err) return console.error(err);
  console.log("admins columns:", rows);
  db.all("SELECT * FROM admins", [], (e2, all) => {
    if (e2) return console.error(e2);
    console.log(all);
  });
});
