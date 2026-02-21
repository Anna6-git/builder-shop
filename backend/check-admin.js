const db = require("./db");

db.all("SELECT id, email, length(password_hash) as len FROM admins", [], (err, rows) => {
  if (err) { console.error("ERR:", err.message); process.exit(1); }
  console.log(rows);
  process.exit(0);
});
