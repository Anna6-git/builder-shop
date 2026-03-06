"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

router.get("/", (_req, res) => {
  db.all(`SELECT key, value FROM settings`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const out = {};
    for (const row of rows) {
      try {
        out[row.key] = JSON.parse(row.value);
      } catch {
        out[row.key] = row.value;
      }
    }
    res.json(out);
  });
});

router.post("/", auth, (req, res) => {
  const body = req.body || {};
  const entries = Object.entries(body);

  if (!entries.length) {
    return res.status(400).json({ error: "No settings provided" });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    let left = entries.length;
    let failed = false;

    const rollback = (msg) => {
      if (failed) return;
      failed = true;
      db.run("ROLLBACK", () => res.status(500).json({ error: msg }));
    };

    const commit = () => {
      if (failed) return;
      db.run("COMMIT", (e) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ ok: true });
      });
    };

    for (const [key, value] of entries) {
      db.run(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(key), JSON.stringify(value)],
        (err) => {
          if (err) return rollback(err.message);
          left -= 1;
          if (left === 0) commit();
        }
      );
    }
  });
});

module.exports = router;