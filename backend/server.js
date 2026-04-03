"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const settingsRoutes = require("./routes/settings");
const ordersRoutes = require("./routes/orders");
const mediaRoutes = require("./routes/media");

const { initDb } = require("./init-db");

const app = express();
const PORT = Number(process.env.PORT) || 3001;

/* -------------------- CORS -------------------- */

const devOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const extraOrigins = String(process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (devOriginRegex.test(origin)) return cb(null, true);
      if (extraOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    allowedHeaders: ["Content-Type", "Authorization", "X-Order-Key"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.options(/.*/, cors());

/* -------------------- MIDDLEWARE -------------------- */

app.use(express.json({ limit: "10mb" }));
const uploadsPath = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data", "uploads");
app.use("/uploads", express.static(uploadsPath));

/* -------------------- HEALTH -------------------- */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* -------------------- ROUTES -------------------- */

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/media", mediaRoutes);

/* -------------------- ERROR HANDLER -------------------- */

app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ error: err.message || "Server error" });
});

/* -------------------- START SERVER -------------------- */
// Віддаємо статичні файли (index.html, стилі, картинки)
app.use(express.static(__dirname));

// Головний маршрут для сайту
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
      if (extraOrigins.length)
        console.log("✅ Extra allowed origins:", extraOrigins);
    });
  })
  .catch((e) => {
    console.error("❌ DB init failed:", e);
    process.exit(1);
  });