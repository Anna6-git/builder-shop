require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const email = (process.env.ADMIN_EMAIL || "").trim();
const password = process.env.ADMIN_PASSWORD || "";

if (!email || !password) {
  console.error("No ADMIN_EMAIL / ADMIN_PASSWORD in .env");
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 10);

  db.run(
    "CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)",
    [],
    (e) => {
      if (e) { console.error(e); process.exit(1); }

      db.run(
        "INSERT INTO admins (email, password_hash) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash",
        [email, hash],
        (err) => {
          if (err) { console.error(err); process.exit(1); }
          console.log("✅ Admin password reset for:", email);
          process.exit(0);
        }
      );
    }
  );
})();
