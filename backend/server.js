"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const settingsRoutes = require("./routes/settings");
const ordersRoutes = require("./routes/orders");

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const API_BASE = "http://localhost:3001";

async function syncProductsFromApi() {
  const res = await fetch(`${API_BASE}/api/products`);
  const prods = await res.json();
  localStorage.setItem("products_db", JSON.stringify(prods));
}

/**
 * ✅ CORS
 * - Dev: дозволяємо будь-який порт на localhost/127.0.0.1
 * - Prod: можна додати через ENV FRONTEND_ORIGINS="https://site1.com,https://site2.com"
 */


const devOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const extraOrigins = String(process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman

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


app.use(express.json({ limit: "2mb" }));

// ✅ статика для завантажених фото
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/orders", ordersRoutes);

// ✅ загальний хендлер помилок
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  if (extraOrigins.length) console.log("✅ Extra allowed origins:", extraOrigins);
});
