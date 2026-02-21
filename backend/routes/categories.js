// backend/routes/categories.js
"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all
const auth = require("../middleware/auth");

// GET all
router.get("/", (req, res) => {
  db.all("SELECT * FROM categories", [], (err, rows) => {
    if (err) {
      console.error("❌ /api/categories error:", err);
      return res.status(500).json({ error: err.message || String(err) });
    }
    res.json(rows);
  });
});

// POST create (захист)
router.post("/", auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  db.run(
    "INSERT INTO categories (name) VALUES (?)",
    [name],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});


module.exports = router;
