"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const bcrypt = require("bcryptjs");
const db = require("./db");

const email = (process.env.ADMIN_EMAIL || "admin@local").trim();
const password = String(process.env.ADMIN_PASSWORD || "admin12345");

(async () => {
  try {
    console.log("FORCE ADMIN:", { email, passLen: password.length });

    const hash = await bcrypt.hash(password, 10);

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);

      db.run(
        `INSERT INTO admins (email, password_hash)
         VALUES (?, ?)
         ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash`,
        [email, hash],
        function (err) {
          if (err) {
            console.error("❌ Admin upsert error:", err.message);
            process.exit(1);
          }
          console.log("✅ Admin ready:", email);
          process.exit(0);
        }
      );
    });
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
})();
