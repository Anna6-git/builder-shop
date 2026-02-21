"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

// тимчасові налаштування (поки без БД)
let settings = {
  shopName: "Builder Shop",
  currency: "UAH",
};

// GET settings (відкрито)
router.get("/", (req, res) => {
  res.json(settings);
});

// UPDATE settings (тільки адмін)
router.post("/", auth, (req, res) => {
  settings = { ...settings, ...(req.body || {}) };
  res.json(settings);
});

module.exports = router;
