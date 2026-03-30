"use strict";

/* =========================
   CONFIG + STORAGE KEYS
========================= */
const API_BASE = window.API_BASE || "http://localhost:3001";

const KEY_CATS = "categories_db";
const KEY_PRODS = "products_db";
const KEY_CART = "cart_v2";
const KEY_USERS = "users_db";
const KEY_SESSION = "current_user";
const KEY_ADMIN_TOKEN = "admin_token";

/* =========================
   STORAGE HELPERS
========================= */
function safeJSONParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getCats() {
  return safeJSONParse(localStorage.getItem(KEY_CATS), []);
}
function setCats(list) {
  localStorage.setItem(KEY_CATS, JSON.stringify(Array.isArray(list) ? list : []));
}
function getProds() {
  return safeJSONParse(localStorage.getItem(KEY_PRODS), []);
}
function setProds(list) {
  localStorage.setItem(KEY_PRODS, JSON.stringify(Array.isArray(list) ? list : []));
}
function getCart() {
  return safeJSONParse(localStorage.getItem(KEY_CART), {});
}
function setCart(obj) {
  localStorage.setItem(KEY_CART, JSON.stringify(obj || {}));
}
function getUsers() {
  return safeJSONParse(localStorage.getItem(KEY_USERS), []);
}
function setUsers(list) {
  localStorage.setItem(KEY_USERS, JSON.stringify(Array.isArray(list) ? list : []));
}
function getSession() {
  return safeJSONParse(localStorage.getItem(KEY_SESSION), null);
}
function setSession(u) {
  localStorage.setItem(KEY_SESSION, JSON.stringify(u));
}
function clearSession() {
  localStorage.removeItem(KEY_SESSION);
}
function getAdminToken() {
  return localStorage.getItem(KEY_ADMIN_TOKEN) || "";
}

/* =========================
   SEED + MIGRATION
========================= */
function seedIfEmpty() {
  let cats = getCats();
  let prods = getProds();

  if (!Array.isArray(cats) || cats.length === 0) {
    cats = [
      { id: 1, name: "Гіпсокартон", icon: "🧱", img: "", order: 1 },
      { id: 2, name: "Профіль", icon: "📐", img: "", order: 2 },
      { id: 3, name: "Суміші", icon: "🪣", img: "", order: 3 },
      { id: 4, name: "Фарби", icon: "🎨", img: "", order: 4 }
    ];
    setCats(cats);
  }

  if (!Array.isArray(prods) || prods.length === 0) {
    prods = [
      { id: 101, title: "Гіпсокартон 12.5 мм, 1.2×2.5 м", catId: 1, brand: "Knauf", price: 265, img: "assets/img/gk.jpg", unit: "шт", unitType: "pcs", stockQty: 20, description: "", code: "", relatedIds: [] },
      { id: 102, title: "Профіль CD 60/27, 3 м", catId: 2, brand: "Rigips", price: 120, img: "assets/img/profil.jpg", unit: "м", unitType: "length", stockQty: 80, description: "", code: "", relatedIds: [] },
      { id: 103, title: "Цемент 25 кг", catId: 3, brand: "Knauf", price: 210, img: "assets/img/cement.jpg", unit: "кг", unitType: "weight", stockQty: 200, description: "", code: "", relatedIds: [] },
      { id: 104, title: "Фарба інтер’єрна матова, 3 л", catId: 4, brand: "Knauf", price: 399, img: "assets/img/farba.jpg", unit: "шт", unitType: "pcs", stockQty: 0, description: "", code: "", relatedIds: [] }
    ];
    setProds(prods);
  }
}

function migrateProductsIfNeeded() {
  const list = getProds();
  if (!Array.isArray(list)) return;

  let changed = false;

  const fixed = list.map((p) => {
    const obj = { ...p };

    if (typeof obj.stockQty === "undefined" && typeof obj.stock === "boolean") {
      obj.stockQty = obj.stock ? 10 : 0;
      changed = true;
    }

    if (!Number.isFinite(Number(obj.stockQty)) || Number(obj.stockQty) < 0) {
      obj.stockQty = 0;
      changed = true;
    }

    if (!obj.unit) {
      obj.unit = obj.unitType === "length" ? "м" : obj.unitType === "weight" ? "кг" : "шт";
      changed = true;
    }

    if (!("description" in obj)) {
      obj.description = "";
      changed = true;
    }

    if (!("code" in obj)) {
      obj.code = "";
      changed = true;
    }

    if (!Array.isArray(obj.relatedIds)) {
      obj.relatedIds = [];
      changed = true;
    }

    return obj;
  });

  if (changed) setProds(fixed);
}

function migrateCategoriesIfNeeded() {
  const list = getCats();
  if (!Array.isArray(list)) return;

  let changed = false;

  const fixed = list.map((c, i) => {
    const obj = { ...c };
    if (!("img" in obj)) {
      obj.img = "";
      changed = true;
    }
    if (!("order" in obj)) {
      obj.order = i + 1;
      changed = true;
    }
    return obj;
  });

  if (changed) setCats(fixed);
}

/* =========================
   UTILS
========================= */
function normalizeQuery(s) {
  return String(s || "").trim().toLowerCase();
}
function unique(arr) {
  return [...new Set(arr)];
}
function unitsForProduct(product) {
  if (product?.unit) return [product.unit];
  if (product?.unitType === "length") return ["м"];
  if (product?.unitType === "weight") return ["кг"];
  return ["шт"];
}
function catById(cats, id) {
  return cats.find((c) => Number(c.id) === Number(id));
}
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function isInStock(p) {
  return Number(p?.stockQty || 0) > 0;
}
function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}
function formatPrice(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}
function cartUniqueProductsCount() {
  const cart = getCart();
  const ids = new Set(Object.keys(cart).map((k) => String(k).split("|")[0]));
  return ids.size;
}
function isAdmin() {
  const u = getSession();
  return Boolean(getAdminToken()) && u?.role === "admin";
}

/* =========================
   API
========================= */
function authHeaders(extra = {}) {
  const token = getAdminToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: authHeaders(options.headers || {})
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" ? data : "") ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

async function uploadImage(file) {
  const form = new FormData();
  form.append("image", file);

  const res = await fetch(`${API_BASE}/api/media/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
let url = data?.url || "";

if (url.startsWith("http://localhost:8080")) {
  url = url.replace("http://localhost:8080", API_BASE);
}

if (url.startsWith("/uploads/")) {
  url = `${API_BASE}${url}`;
}

return url;
}

async function loadSettingsFromBackend() {
  try {
    const settings = await api("/settings", { method: "GET" });

    if (Array.isArray(settings?.slides)) {
      SLIDES = normalizeSlides(settings.slides);
    }

    if (Array.isArray(settings?.homeInfoCards) && settings.homeInfoCards.length) {
      HOME_INFO_CARDS = settings.homeInfoCards;
    }
  } catch (e) {
    console.warn("settings load failed:", e);
  }
}
/* =========================
   HEADER SETTINGS
========================= */
function applyHeaderSettings() {
  const siteTitle = document.getElementById("siteTitle");
  if (siteTitle) siteTitle.textContent = "БудМаркет";

  const tg = document.getElementById("tgLink");
  const vb = document.getElementById("viberLink");
  const p1 = document.getElementById("phone1");
  const p2 = document.getElementById("phone2");
  const p3 = document.getElementById("phone3");
  const wt = document.getElementById("workTime");

  if (tg) tg.href = "https://t.me/MarinaStyaglyuk";
  if (vb) vb.href = "viber://chat?number=%2B380979129698";

  if (p1) p1.href = "tel:+380988966988";
  if (p2) p2.href = "tel:+380979129698";
  if (p3) p3.href = "tel:+380979129690";
  if (wt) wt.textContent = "Пн–Сб 09:00–17:00 • Нд вихідний";
}

/* =========================
   UI ELEMENTS
========================= */
const cartCountEl = document.getElementById("cartCount");
const productsSection = document.getElementById("productsSection");
const productsTitle = document.getElementById("productsTitle");
const prodGrid = document.getElementById("prodGrid");
const backToCatalogBtn = document.getElementById("backToCatalogBtn");
const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const inStockOnly = document.getElementById("inStockOnly");
const brandList = document.getElementById("brandList");
const unitList = document.getElementById("unitList");

const applyFiltersBtn = document.getElementById("applyFiltersBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const modalOverlay = document.getElementById("modalOverlay");
const productModal = document.getElementById("productModal");
const mClose = document.getElementById("mClose");
const mTitle = document.getElementById("mTitle");
const mImg = document.getElementById("mImg");
const mPrice = document.getElementById("mPrice");
const mMeta = document.getElementById("mMeta");
const mHint = document.getElementById("mHint");
const mMinus = document.getElementById("mMinus");
const mPlus = document.getElementById("mPlus");
const mQty = document.getElementById("mQty");
const mUnit = document.getElementById("mUnit");
const mAdd = document.getElementById("mAdd");

const catalogNav = document.getElementById("catalogNav");
const catalogGrid = document.getElementById("catalogGrid");

const slidesBox = document.getElementById("slides");
const dotsBox = document.getElementById("dots");
const prevSlideBtn = document.getElementById("prevSlide");
const nextSlideBtn = document.getElementById("nextSlide");

const burgerBtn = document.getElementById("burgerBtn");
const bottomMenuBtn = document.getElementById("bottomMenuBtn");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const drawerClose = document.getElementById("drawerClose");

const adminAddCategoryBtn = document.getElementById("adminAddCategoryBtn");
const adminAddProductBtn = document.getElementById("adminAddProductBtn");
const adminEditCurrentBtn = document.getElementById("adminEditCurrentBtn");

let activeCatId = null;
let currentProduct = null;
let editingCategoryId = null;
let editingProductId = null;

/* =========================
   DRAWER
========================= */
function openDrawer() {
  document.body.classList.add("drawerOpen");
  if (drawerOverlay) drawerOverlay.hidden = false;
  drawer?.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  document.body.classList.remove("drawerOpen");
  if (drawerOverlay) drawerOverlay.hidden = true;
  drawer?.setAttribute("aria-hidden", "true");
}

burgerBtn?.addEventListener("click", openDrawer);
bottomMenuBtn?.addEventListener("click", openDrawer);
drawerClose?.addEventListener("click", closeDrawer);
drawerOverlay?.addEventListener("click", closeDrawer);

/* =========================
   REVEAL
========================= */
function initReveal() {
  const nodes = Array.from(document.querySelectorAll(".reveal"));
  if (!nodes.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  nodes.forEach((n) => io.observe(n));
}

/* =========================
   ADMIN VISIBILITY
========================= */
function refreshAdminUI() {

  document.querySelectorAll(".adminOnly").forEach((el) => {
    el.hidden = !isAdmin();
  });
}

/* =========================
   CATALOG
========================= */
function renderLeftCatalog(cats) {
  if (!catalogNav) return;
  catalogNav.innerHTML = "";

  if (!cats.length) {
    catalogNav.innerHTML = `<div class="hint">Немає категорій.</div>`;
    return;
  }

  cats.forEach((c) => {
    const a = document.createElement("a");
    a.className = "catalogNav__item";
    a.href = "#";
    a.innerHTML = `
      <span class="catalogNav__icon">${c.icon || "📦"}</span>
      <span class="catalogNav__name">${escapeHTML(c.name)}</span>
    `;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      closeDrawer();
      openCategory(c.id);
    });
    catalogNav.appendChild(a);
  });
}

function renderCatalogCards(cats) {
  if (!catalogGrid) return;
  catalogGrid.innerHTML = "";

  cats.forEach((c) => {
    const card = document.createElement("div");
    card.className = "catalogCard";

    card.innerHTML = `
      <button type="button" class="catalogCard__main">
        <div class="catalogCard__imgWrap">
        <img class="catalogCard__img" src="${
  c.img
    ? escapeHTML(c.img)
    : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='320' viewBox='0 0 600 320'><rect width='600' height='320' fill='%23eef2f7'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='28'>Немає фото</text></svg>"
}" alt="${escapeHTML(c.name)}">
        </div>
        <div class="catalogCard__title">${escapeHTML(c.name)}</div>
      </button>
      ${
        isAdmin()
          ? `
            <div class="catalogCard__adminActions adminOnly">
              <button class="adminTinyBtn" data-act="edit-cat" data-id="${c.id}" type="button">Редагувати</button>
              <button class="adminTinyBtn adminTinyBtn--danger" data-act="del-cat" data-id="${c.id}" type="button">Видалити</button>
            </div>
          `
          : ""
      }
    `;

card.querySelector(".catalogCard__main")?.addEventListener("click", () => {
  window.location.href = `category.html?cat=${c.id}`;
});
    card.querySelector('[data-act="edit-cat"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      openCategoryAdminModal(c);
    });
    card.querySelector('[data-act="del-cat"]')?.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteCategory(c.id);
    });

    catalogGrid.appendChild(card);
  });
}

function renderCatalog() {
const cats = getCats().slice().sort((a, b) =>
  String(a.name || "").localeCompare(String(b.name || ""), "uk", { sensitivity: "base" })
);
  renderLeftCatalog(cats);
  renderCatalogCards(cats);
}

/* =========================
   FILTERS
========================= */
function renderFilterCheckboxes(container, values, prefix) {
  if (!container) return;
  container.innerHTML = "";

  values.forEach((v) => {
    const safe = String(v).replaceAll(" ", "_");
    const id = `${prefix}_${safe}`;
    const label = document.createElement("label");
    label.className = "check";
    label.innerHTML = `<input type="checkbox" value="${escapeHTML(v)}" id="${id}"><span>${escapeHTML(v)}</span>`;
    container.appendChild(label);
  });
}

function getCheckedValues(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((x) => x.value);
}

function resetFiltersUI(list) {
  const prices = list.map((p) => Number(p.price) || 0);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 999999;

  if (minPrice) minPrice.value = String(min);
  if (maxPrice) maxPrice.value = String(max);
  if (inStockOnly) inStockOnly.checked = false;

  const brands = unique(list.map((p) => p.brand).filter(Boolean)).sort();
  const units = unique(list.flatMap((p) => unitsForProduct(p))).sort();

  renderFilterCheckboxes(brandList, brands, "brand");
  renderFilterCheckboxes(unitList, units, "unit");
}

function applyFiltersToList(list) {
  const min = Number(minPrice?.value) || 0;
  const max = Number(maxPrice?.value) || 999999999;
  const onlyStock = Boolean(inStockOnly?.checked);
  const brands = getCheckedValues(brandList);
  const units = getCheckedValues(unitList);

  return list.filter((p) => {
    if (Number(p.price) < min || Number(p.price) > max) return false;
    if (onlyStock && !isInStock(p)) return false;
    if (brands.length && !brands.includes(p.brand)) return false;
    if (units.length) {
      const possible = unitsForProduct(p);
      if (!units.some((u) => possible.includes(u))) return false;
    }
    return true;
  });
}

/* =========================
   PRODUCTS
========================= */
function renderProducts(list, titleText) {
  if (productsTitle) productsTitle.textContent = titleText;
  if (!prodGrid) return;

  prodGrid.innerHTML = "";

  if (!list.length) {
    prodGrid.innerHTML = `<div class="hint">Нічого не знайдено.</div>`;
    return;
  }

  const cats = getCats();

  list.forEach((p) => {
    const c = catById(cats, p.catId);
const stockText = Number(p.isCustomOrder || 0) === 1
  ? " • Під замовлення"
  : isInStock(p)
    ? ` • В наявності: ${p.stockQty}`
    : " • Немає в наявності";

    const card = document.createElement("article");
    card.className = "prodCard";

    card.innerHTML = `
      <div class="prodCard__main">
        <img class="prodImg" src="${escapeHTML(p.img || "")}" alt="${escapeHTML(p.title)}" loading="lazy">
        <div class="prodBody">
          <h3 class="prodTitle">${escapeHTML(p.title)}</h3>
          <p class="prodMeta">${escapeHTML(c ? c.name : "Категорія")} • ${escapeHTML(p.brand || "")}${stockText}</p>
          <div class="prodBottom">
            <div>
  <div class="prodPrice">${formatPrice(p.price)} ₴</div>
  ${
    Number(p.isCustomOrder || 0) === 1
      ? `<div class="hint" style="margin-top:4px; color:#b45309; font-weight:700;">Під замовлення</div>`
      : ""
  }
</div>
          </div>
        </div>
      </div>
      ${
        isAdmin()
          ? `
            <div class="prodCard__adminActions adminOnly">
              <button class="adminTinyBtn" data-act="edit-product" data-id="${p.id}" type="button">Редагувати</button>
              <button class="adminTinyBtn adminTinyBtn--danger" data-act="del-product" data-id="${p.id}" type="button">Видалити</button>
            </div>
          `
          : ""
      }
    `;

    card.querySelector(".prodCard__main")?.addEventListener("click", () => {
      window.location.href = `product.html?id=${p.id}`;
    });

    card.querySelector('[data-act="edit-product"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      openProductAdminModal(p);
    });

    card.querySelector('[data-act="del-product"]')?.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteProduct(p.id);
    });

    prodGrid.appendChild(card);
  });
}

function openCategory(catId) {
  window.location.href = `category.html?cat=${catId}`;
}

function backToCatalog() {
  activeCatId = null;
  if (productsSection) productsSection.hidden = true;
  if (suggestions) suggestions.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   SEARCH
========================= */
function findProductsByQuery(q) {
  const query = normalizeQuery(q);
  if (!query) return [];

  return getProds()
    .filter((p) => {
      const title = normalizeQuery(p.title);
      const brand = normalizeQuery(p.brand);
      const description = normalizeQuery(p.description);
      return title.includes(query) || brand.includes(query) || description.includes(query);
    })
    .slice(0, 8);
}

function showSuggestions(items) {
  if (!suggestions) return;

  if (!items.length) {
    suggestions.hidden = true;
    suggestions.innerHTML = "";
    return;
  }

  const cats = getCats();
  suggestions.hidden = false;
  suggestions.innerHTML = "";

  items.forEach((p) => {
    const c = catById(cats, p.catId);
    const row = document.createElement("div");
    row.className = "suggItem";
    row.innerHTML = `
      <img class="suggImg" src="${escapeHTML(p.img || "")}" alt="">
      <div>
        <div class="suggTitle">${escapeHTML(p.title)}</div>
        <div class="suggMeta">${escapeHTML(c ? c.name : "")} • ${formatPrice(p.price)} ₴</div>
      </div>
    `;
    row.addEventListener("click", () => {
      suggestions.hidden = true;
      window.location.href = `product.html?id=${p.id}`;
    });
    suggestions.appendChild(row);
  });
}

/* =========================
   CART BADGE
========================= */
function updateCartBadge() {
  if (!cartCountEl) return;
  cartCountEl.textContent = String(cartUniqueProductsCount());
}

/* =========================
   MINI MODAL
========================= */
function ensureAddedModal() {
  if (document.getElementById("addedModal")) return;

  const wrap = document.createElement("div");
  wrap.id = "addedModal";
  wrap.className = "miniModal";
  wrap.hidden = true;

  wrap.innerHTML = `
    <div class="miniModal__backdrop" data-act="close"></div>
    <div class="miniModal__box" role="dialog" aria-modal="true" aria-label="Додано в кошик">
      <div class="miniModal__title">Товар додано в кошик</div>
      <div class="miniModal__body">
        <img id="addedImg" src="" alt="">
        <div>
          <div id="addedTitle" class="miniModal__name"></div>
          <div id="addedMeta" class="miniModal__meta"></div>
        </div>
      </div>
      <div class="miniModal__actions">
        <button class="btnPrimary" id="btnContinue" type="button">Продовжити покупку</button>
        <a class="btn" id="btnGoCart" href="cart.html">Перейти до кошика</a>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => {
    const act = e.target?.dataset?.act;
    if (act === "close") hideAddedModal();
  });

  document.getElementById("btnContinue")?.addEventListener("click", hideAddedModal);

  document.addEventListener("keydown", (e) => {
    const el = document.getElementById("addedModal");
    if (e.key === "Escape" && el && !el.hidden) hideAddedModal();
  });
}

function showAddedModal(p, qty, unit) {
  ensureAddedModal();
  const el = document.getElementById("addedModal");
  const img = document.getElementById("addedImg");
  const title = document.getElementById("addedTitle");
  const meta = document.getElementById("addedMeta");

  if (!el) return;

  if (img) {
    img.src = p.img || "";
    img.alt = p.title || "";
  }
  if (title) title.textContent = p.title || "";
  if (meta) meta.textContent = `Кількість: ${qty} ${unit}`;

  el.hidden = false;
  document.body.classList.add("miniModalOpen");
}

function hideAddedModal() {
  const el = document.getElementById("addedModal");
  if (!el) return;
  el.hidden = true;
  document.body.classList.remove("miniModalOpen");
}

/* =========================
   PRODUCT MODAL
========================= */
function openProductModal(p) {
  currentProduct = p;
  const c = catById(getCats(), p.catId);

  if (mTitle) mTitle.textContent = p.title;
  if (mImg) {
    mImg.src = p.img || "";
    mImg.alt = p.title || "";
  }
  if (mPrice) mPrice.textContent = `${formatPrice(p.price)} ₴`;

  const stockText = isInStock(p) ? ` • В наявності: ${p.stockQty}` : " • Немає в наявності";
  if (mMeta) {
    const extra = p.description ? ` • ${p.description}` : "";
    mMeta.textContent = `${c ? c.name : "Категорія"} • ${p.brand || ""}${stockText}${extra}`;
  }

  if (mHint) mHint.textContent = isInStock(p) ? "" : "Цього товару зараз немає в наявності.";
  if (mAdd) mAdd.disabled = !isInStock(p);

  if (mUnit) {
    mUnit.innerHTML = "";
    unitsForProduct(p).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      mUnit.appendChild(opt);
    });
  }

  if (mQty) {
    if (p.unitType === "length" || p.unitType === "weight") {
      mQty.step = "0.1";
      mQty.min = "0.1";
      mQty.value = "1";
    } else {
      mQty.step = "1";
      mQty.min = "1";
      mQty.value = "1";
    }

    if (p.unitType === "pcs") {
      const max = Number(p.stockQty || 0);
      if (max > 0) mQty.max = String(max);
      else mQty.removeAttribute("max");
    } else {
      mQty.removeAttribute("max");
    }
  }

  if (adminEditCurrentBtn) adminEditCurrentBtn.hidden = !isAdmin();

  document.body.classList.add("modalProductOpen");
  productModal?.setAttribute("aria-hidden", "false");
}

function closeProductModal() {
  productModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalProductOpen");
  currentProduct = null;
}


/* =========================
   SLIDER
========================= */
let SLIDES = [
  {
    title: "НОВИНКА!",
    subtitle: "Декоративні покриття для інтер’єру",
    imageUrl: "assets/img/banner1.jpg",
    linkType: "none",
    linkValue: "",
    buttonText: ""
  },
  {
    title: "ЗНИЖКИ",
    subtitle: "Топові матеріали за вигідними цінами",
    imageUrl: "assets/img/banner2.jpg",
    linkType: "none",
    linkValue: "",
    buttonText: ""
  },
  {
    title: "ДОСТАВКА",
    subtitle: "По Радомишлю та області — уточнюйте в магазині",
    imageUrl: "assets/img/banner3.jpg",
    linkType: "none",
    linkValue: "",
    buttonText: ""
  }
];

let sliderIndex = 0;
let sliderTimer = null;

function normalizeSlides(rawSlides) {
  if (!Array.isArray(rawSlides)) return [];

  return rawSlides.map((s) => ({
    title: String(s?.title || "").trim(),
    subtitle: String(s?.subtitle || "").trim(),
    imageUrl: String(s?.imageUrl || "").trim(),
    linkType: ["none", "category", "product"].includes(String(s?.linkType || "none"))
      ? String(s.linkType)
      : "none",
    linkValue: s?.linkValue != null ? String(s.linkValue).trim() : "",
    buttonText: String(s?.buttonText || "").trim()
  }));
}

function getSlideHref(slide) {
  if (!slide) return "";

  const type = String(slide.linkType || "none");
  const value = String(slide.linkValue || "").trim();

  if (!value || type === "none") return "";

  if (type === "category") {
    return `category.html?cat=${encodeURIComponent(value)}`;
  }

  if (type === "product") {
    return `product.html?id=${encodeURIComponent(value)}`;
  }

  return "";
}

function renderSlider() {
  if (!slidesBox || !dotsBox) return;

  SLIDES = normalizeSlides(SLIDES);

  slidesBox.innerHTML = "";
  dotsBox.innerHTML = "";

  if (!SLIDES.length) {
    slidesBox.innerHTML = `
      <div class="slide active">
        <div class="slideOverlay"></div>
        <div class="slideText">
          <h2>Слайдів поки немає</h2>
        </div>
      </div>
    `;
    return;
  }

  SLIDES.forEach((s, i) => {
    const slide = document.createElement("div");
    slide.className = "slide" + (i === 0 ? " active" : "");
    slide.style.backgroundImage = `url("${s.imageUrl}")`;

    const href = getSlideHref(s);
    const hasLink = Boolean(href);
    const buttonText = s.buttonText || "Перейти";

    slide.innerHTML = `
      <div class="slideOverlay"></div>
      <div class="slideText">
        ${s.title ? `<h2>${escapeHTML(s.title)}</h2>` : ""}
        ${s.subtitle ? `<p>${escapeHTML(s.subtitle)}</p>` : ""}
        ${
          hasLink
            ? `<a class="slideBtn" href="${escapeHTML(href)}">${escapeHTML(buttonText)}</a>`
            : ""
        }
      </div>
    `;

    slidesBox.appendChild(slide);

    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.type = "button";
    dot.setAttribute("aria-label", `Перейти до слайду ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i, true));
    dotsBox.appendChild(dot);
  });

  sliderIndex = 0;
  updateSliderNavVisibility();
  startAutoSlider();
}

function goToSlide(i, restart = false) {
  if (!slidesBox || !dotsBox || !SLIDES.length) return;

  const slides = Array.from(slidesBox.querySelectorAll(".slide"));
  const dots = Array.from(dotsBox.querySelectorAll(".dot"));

  slides[sliderIndex]?.classList.remove("active");
  dots[sliderIndex]?.classList.remove("active");

  sliderIndex = (i + SLIDES.length) % SLIDES.length;

  slides[sliderIndex]?.classList.add("active");
  dots[sliderIndex]?.classList.add("active");

  if (restart) startAutoSlider();
}

function startAutoSlider() {
  if (sliderTimer) clearInterval(sliderTimer);

  if (SLIDES.length <= 1) return;

  sliderTimer = setInterval(() => {
    goToSlide(sliderIndex + 1, false);
  }, 8000);
}

function stopAutoSlider() {
  if (sliderTimer) {
    clearInterval(sliderTimer);
    sliderTimer = null;
  }
}

function updateSliderNavVisibility() {
  const shouldShow = SLIDES.length > 1;

  if (prevSlideBtn) prevSlideBtn.hidden = !shouldShow;
  if (nextSlideBtn) nextSlideBtn.hidden = !shouldShow;
  if (dotsBox) dotsBox.hidden = !shouldShow;
}

/* =========================
   SLIDES ADMIN
========================= */
const adminSlidesBtn = document.getElementById("adminSlidesBtn");
const adminSlidesOverlay = document.getElementById("adminSlidesOverlay");
const adminSlidesModal = document.getElementById("adminSlidesModal");
const adminSlidesClose = document.getElementById("adminSlidesClose");
const slidesAdminList = document.getElementById("slidesAdminList");
const addSlideBtn = document.getElementById("addSlideBtn");
const slidesAdminHint = document.getElementById("slidesAdminHint");

function openSlidesAdminModal() {
  if (!isAdmin()) return;
  renderSlidesAdminList();
  if (adminSlidesOverlay) adminSlidesOverlay.hidden = false;
  if (adminSlidesModal) adminSlidesModal.hidden = false;
}

function closeSlidesAdminModal() {
  if (adminSlidesOverlay) adminSlidesOverlay.hidden = true;
  if (adminSlidesModal) adminSlidesModal.hidden = true;
}

adminSlidesBtn?.addEventListener("click", openSlidesAdminModal);
adminSlidesClose?.addEventListener("click", closeSlidesAdminModal);
adminSlidesOverlay?.addEventListener("click", closeSlidesAdminModal);

async function saveSlidesToBackend() {
  await api("/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slides: SLIDES })
  });
}

function renderSlidesAdminList() {
  if (!slidesAdminList) return;

  slidesAdminList.innerHTML = "";

  const cats = getCats();
  const prods = getProds();

  SLIDES.forEach((slide, index) => {
    const safeSlide = {
      title: String(slide?.title || ""),
      subtitle: String(slide?.subtitle || ""),
      imageUrl: String(slide?.imageUrl || ""),
      linkType: ["none", "category", "product"].includes(String(slide?.linkType || "none"))
        ? String(slide.linkType)
        : "none",
      linkValue: slide?.linkValue != null ? String(slide.linkValue) : "",
      buttonText: String(slide?.buttonText || "")
    };

    const categoryOptions = [
      `<option value="">Оберіть категорію</option>`,
      ...cats.map(
        (c) =>
          `<option value="${escapeHTML(String(c.id))}" ${
            safeSlide.linkType === "category" && String(c.id) === safeSlide.linkValue ? "selected" : ""
          }>${escapeHTML(c.name)}</option>`
      )
    ].join("");

    const productOptions = [
      `<option value="">Оберіть товар</option>`,
      ...prods.map(
        (p) =>
          `<option value="${escapeHTML(String(p.id))}" ${
            safeSlide.linkType === "product" && String(p.id) === safeSlide.linkValue ? "selected" : ""
          }>${escapeHTML(p.title)}</option>`
      )
    ].join("");

    const card = document.createElement("div");
    card.className = "slideAdminCard";
    card.innerHTML = `
      <div class="slideAdminCard__title">Слайд ${index + 1}</div>
      <div class="slideAdminCard__grid">
        <input
          class="authInput"
          data-field="title"
          data-index="${index}"
          placeholder="Заголовок"
          value="${escapeHTML(safeSlide.title)}"
        >

        <input
          class="authInput"
          data-field="subtitle"
          data-index="${index}"
          placeholder="Підзаголовок"
          value="${escapeHTML(safeSlide.subtitle)}"
        >

        <input
          class="authInput"
          data-field="imageUrl"
          data-index="${index}"
          placeholder="Фото URL"
          value="${escapeHTML(safeSlide.imageUrl)}"
        >

        <input class="authInput slideFileInput" data-index="${index}" type="file" accept="image/*">

        <select class="authInput slideLinkTypeInput" data-field="linkType" data-index="${index}">
          <option value="none" ${safeSlide.linkType === "none" ? "selected" : ""}>Без переходу</option>
          <option value="category" ${safeSlide.linkType === "category" ? "selected" : ""}>Перехід у категорію</option>
          <option value="product" ${safeSlide.linkType === "product" ? "selected" : ""}>Перехід у товар</option>
        </select>

        <select
          class="authInput slideCategorySelect"
          data-field="categoryValue"
          data-index="${index}"
          ${safeSlide.linkType === "category" ? "" : "hidden"}
        >
          ${categoryOptions}
        </select>

        <select
          class="authInput slideProductSelect"
          data-field="productValue"
          data-index="${index}"
          ${safeSlide.linkType === "product" ? "" : "hidden"}
        >
          ${productOptions}
        </select>

        <input
          class="authInput"
          data-field="buttonText"
          data-index="${index}"
          placeholder="Текст кнопки, напр. Перейти"
          value="${escapeHTML(safeSlide.buttonText)}"
        >

        <img class="slideAdminPreview" src="${escapeHTML(safeSlide.imageUrl || "")}" alt="">

        <div class="slideAdminActions">
          <button class="btnPrimary" data-act="save-slide" data-index="${index}" type="button">Зберегти</button>
          <button class="btnDanger" data-act="delete-slide" data-index="${index}" type="button">Видалити</button>
        </div>
      </div>
    `;

    slidesAdminList.appendChild(card);
  });

  slidesAdminList.querySelectorAll(".slideFileInput").forEach((input) => {
    input.addEventListener("change", async () => {
      const index = Number(input.dataset.index);
      const file = input.files?.[0];
      if (!file) return;

      try {
        if (slidesAdminHint) slidesAdminHint.textContent = "Завантажую фото...";
        const url = await uploadImage(file);
        const urlInput = slidesAdminList.querySelector(`input[data-field="imageUrl"][data-index="${index}"]`);
        const preview = input.parentElement.querySelector(".slideAdminPreview");

        if (urlInput) urlInput.value = url;
        if (preview) preview.src = url;

        if (slidesAdminHint) slidesAdminHint.textContent = "Фото завантажено.";
      } catch (e) {
        if (slidesAdminHint) slidesAdminHint.textContent = "Помилка: " + e.message;
      }
    });
  });

  slidesAdminList.querySelectorAll(".slideLinkTypeInput").forEach((select) => {
    select.addEventListener("change", () => {
      const index = Number(select.dataset.index);
      const linkType = select.value;

      const categorySelect = slidesAdminList.querySelector(`.slideCategorySelect[data-index="${index}"]`);
      const productSelect = slidesAdminList.querySelector(`.slideProductSelect[data-index="${index}"]`);

      if (categorySelect) categorySelect.hidden = linkType !== "category";
      if (productSelect) productSelect.hidden = linkType !== "product";
    });
  });

  slidesAdminList.querySelectorAll('[data-act="save-slide"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.index);

      const titleInput = slidesAdminList.querySelector(`input[data-field="title"][data-index="${index}"]`);
      const subtitleInput = slidesAdminList.querySelector(`input[data-field="subtitle"][data-index="${index}"]`);
      const imageInput = slidesAdminList.querySelector(`input[data-field="imageUrl"][data-index="${index}"]`);
      const linkTypeInput = slidesAdminList.querySelector(`select[data-field="linkType"][data-index="${index}"]`);
      const categorySelect = slidesAdminList.querySelector(`select[data-field="categoryValue"][data-index="${index}"]`);
      const productSelect = slidesAdminList.querySelector(`select[data-field="productValue"][data-index="${index}"]`);
      const buttonTextInput = slidesAdminList.querySelector(`input[data-field="buttonText"][data-index="${index}"]`);

      const linkType = String(linkTypeInput?.value || "none");
      let linkValue = "";

      if (linkType === "category") {
        linkValue = String(categorySelect?.value || "").trim();
      } else if (linkType === "product") {
        linkValue = String(productSelect?.value || "").trim();
      }

      SLIDES[index] = {
        title: String(titleInput?.value || "").trim(),
        subtitle: String(subtitleInput?.value || "").trim(),
        imageUrl: String(imageInput?.value || "").trim(),
        linkType,
        linkValue,
        buttonText: String(buttonTextInput?.value || "").trim()
      };

      await saveSlidesToBackend();
      await loadSettingsFromBackend();
      renderSlider();
      renderSlidesAdminList();

      if (slidesAdminHint) slidesAdminHint.textContent = "Слайд збережено.";
    });
  });

  slidesAdminList.querySelectorAll('[data-act="delete-slide"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.index);

      if (SLIDES.length <= 1) {
        if (slidesAdminHint) slidesAdminHint.textContent = "Має залишитися хоча б один слайд.";
        return;
      }

      SLIDES.splice(index, 1);
      await saveSlidesToBackend();
      await loadSettingsFromBackend();
      renderSlider();
      renderSlidesAdminList();

      if (slidesAdminHint) slidesAdminHint.textContent = "Слайд видалено.";
    });
  });
}

addSlideBtn?.addEventListener("click", async () => {
  SLIDES.push({
    title: "Новий слайд",
    subtitle: "",
    imageUrl: "",
    linkType: "none",
    linkValue: "",
    buttonText: ""
  });

  await saveSlidesToBackend();
  await loadSettingsFromBackend();
  renderSlider();
  renderSlidesAdminList();
});

let HOME_INFO_CARDS = [
  {
    title: "Швидке замовлення",
    text: "Оформлюйте кошик за кілька хвилин зі смартфона."
  },
  {
    title: "Доставка",
    text: "По Радомишлю та району — уточнюйте в магазині."
  }
];

/* =========================
   AUTH
========================= */
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");
const userBox = document.getElementById("userBox");
const userHello = document.getElementById("userHello");

const authOverlay = document.getElementById("authOverlay");
const authModal = document.getElementById("authModal");
const authClose = document.getElementById("authClose");
const authTitle = document.getElementById("authTitle");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const lName = document.getElementById("lName");
const lPass = document.getElementById("lPass");
const lHint = document.getElementById("lHint");
const rName = document.getElementById("rName");
const rSurname = document.getElementById("rSurname");
const rContact = document.getElementById("rContact");
const rPass = document.getElementById("rPass");
const rHint = document.getElementById("rHint");
const toLogin = document.getElementById("toLogin");
const toRegister = document.getElementById("toRegister");

function refreshAuthUI() {
  const u = getSession();

  if (u) {
    if (btnLogin) btnLogin.hidden = true;
    if (btnRegister) btnRegister.hidden = true;
    if (userBox) userBox.hidden = false;
    if (userHello) {
      userHello.textContent = u.role === "admin"
        ? `Адмін: ${u.email || "admin"}`
        : `Привіт, ${u.name || "користувачу"}!`;
    }
  } else {
    if (btnLogin) btnLogin.hidden = false;
    if (btnRegister) btnRegister.hidden = false;
    if (userBox) userBox.hidden = true;
  }

  refreshAdminUI();
  renderCatalog();

  if (activeCatId) {
    const list = getProds().filter((p) => Number(p.catId) === Number(activeCatId));
    renderProducts(list, catById(getCats(), activeCatId)?.name || "Товари");
  }
}

function openAuth(mode) {
  if (!authOverlay || !authModal || !loginForm || !registerForm) return;

  authOverlay.hidden = false;
  authModal.hidden = false;
  authModal.setAttribute("aria-hidden", "false");

  loginForm.hidden = true;
  registerForm.hidden = true;

  if (lHint) lHint.textContent = "";
  if (rHint) rHint.textContent = "";

  if (mode === "login") {
    if (authTitle) authTitle.textContent = "Вхід";
    loginForm.hidden = false;
    setTimeout(() => lName?.focus(), 0);
  } else {
    if (authTitle) authTitle.textContent = "Реєстрація";
    registerForm.hidden = false;
    setTimeout(() => rName?.focus(), 0);
  }
}

function closeAuth() {
  authModal?.setAttribute("aria-hidden", "true");
  if (authModal) authModal.hidden = true;
  if (authOverlay) authOverlay.hidden = true;
  if (loginForm) loginForm.hidden = true;
  if (registerForm) registerForm.hidden = true;
  if (lHint) lHint.textContent = "";
  if (rHint) rHint.textContent = "";
}

btnLogin?.addEventListener("click", () => openAuth("login"));
btnRegister?.addEventListener("click", () => openAuth("register"));
toLogin?.addEventListener("click", () => openAuth("login"));
toRegister?.addEventListener("click", () => openAuth("register"));
authClose?.addEventListener("click", closeAuth);
authOverlay?.addEventListener("click", closeAuth);

async function tryAdminLogin(loginId, pass) {
  const resp = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginId, password: pass })
  });

  const data = await resp.json().catch(() => null);

  if (resp.ok && data?.ok && data?.user?.role === "admin" && data?.token) {
    localStorage.setItem(KEY_ADMIN_TOKEN, data.token);
    localStorage.setItem(KEY_SESSION, JSON.stringify(data.user));
    refreshAuthUI();
    closeAuth();
    closeDrawer();
    return true;
  }

  return false;
}

registerForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = String(rName?.value || "").trim();
  const surname = String(rSurname?.value || "").trim();
  const contact = String(rContact?.value || "").trim();
  const pass = String(rPass?.value || "").trim();

  if (!name || !surname || !contact || !pass) {
    if (rHint) rHint.textContent = "Заповніть всі поля.";
    return;
  }

  const users = getUsers();
  const keyContact = contact.toLowerCase();

  if (users.some((u) => String(u.contact || "").toLowerCase() === keyContact)) {
    if (rHint) rHint.textContent = "Користувач з таким контактом вже існує.";
    return;
  }

  const user = { id: Date.now(), name, surname, contact, pass, role: "user" };
  users.push(user);
  setUsers(users);

  setSession({ id: user.id, name: user.name, contact: user.contact, role: "user" });
  closeAuth();
  refreshAuthUI();
  closeDrawer();
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const loginId = String(lName?.value || "").trim();
  const pass = String(lPass?.value || "").trim();

  if (!loginId || !pass) {
    if (lHint) lHint.textContent = "Введіть логін та пароль.";
    return;
  }

  try {
    const adminLogged = await tryAdminLogin(loginId, pass);
    if (adminLogged) return;
  } catch (err) {
    console.warn("Admin login check failed:", err);
  }

  const users = getUsers();
  const key = loginId.toLowerCase();

  const u = users.find((x) => {
    const nameOk = String(x.name || "").toLowerCase() === key;
    const contactOk = String(x.contact || "").toLowerCase() === key;
    return (nameOk || contactOk) && x.pass === pass;
  });

  if (!u) {
    if (lHint) lHint.textContent = "Невірний логін або пароль.";
    return;
  }

  localStorage.removeItem(KEY_ADMIN_TOKEN);
  setSession({ id: u.id, name: u.name, contact: u.contact, role: "user" });
  closeAuth();
  refreshAuthUI();
  closeDrawer();
});

btnLogout?.addEventListener("click", () => {
  clearSession();
  localStorage.removeItem(KEY_ADMIN_TOKEN);
  refreshAuthUI();
  closeDrawer();
});

/* =========================
   CATEGORY ADMIN MODAL
========================= */
const adminCategoryOverlay = document.getElementById("adminCategoryOverlay");
const adminCategoryModal = document.getElementById("adminCategoryModal");
const adminCategoryClose = document.getElementById("adminCategoryClose");
const adminCategoryTitle = document.getElementById("adminCategoryTitle");
const catNameInput = document.getElementById("catNameInput");
const catIconInput = document.getElementById("catIconInput");
const catOrderInput = document.getElementById("catOrderInput");
const catImgInput = document.getElementById("catImgInput");
const catFileInput = document.getElementById("catFileInput");
const catPreview = document.getElementById("catPreview");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const deleteCategoryBtn = document.getElementById("deleteCategoryBtn");
const catFormHint = document.getElementById("catFormHint");

function openCategoryAdminModal(category = null) {
  if (!isAdmin()) return;

  editingCategoryId = category?.id || null;
  if (adminCategoryTitle) {
    adminCategoryTitle.textContent = category ? "Редагувати категорію" : "Додати категорію";
  }

  if (catNameInput) catNameInput.value = category?.name || "";
  if (catIconInput) catIconInput.value = category?.icon || "";
  if (catOrderInput) catOrderInput.value = String(category?.order ?? 9999);
  if (catImgInput) catImgInput.value = category?.img || "";
  if (catFileInput) catFileInput.value = "";
  if (catFormHint) catFormHint.textContent = "";

  if (catPreview) {
    if (category?.img) {
      catPreview.src = category.img;
      catPreview.hidden = false;
    } else {
      catPreview.hidden = true;
      catPreview.removeAttribute("src");
    }
  }

  if (deleteCategoryBtn) deleteCategoryBtn.hidden = !category;
  if (adminCategoryOverlay) adminCategoryOverlay.hidden = false;
  if (adminCategoryModal) adminCategoryModal.hidden = false;
}

function closeCategoryAdminModal() {
  if (adminCategoryOverlay) adminCategoryOverlay.hidden = true;
  if (adminCategoryModal) adminCategoryModal.hidden = true;
  editingCategoryId = null;
}

adminCategoryClose?.addEventListener("click", closeCategoryAdminModal);
adminCategoryOverlay?.addEventListener("click", closeCategoryAdminModal);
adminAddCategoryBtn?.addEventListener("click", () => openCategoryAdminModal());

catImgInput?.addEventListener("input", () => {
  const url = String(catImgInput.value || "").trim();
  if (!catPreview) return;

  if (url) {
    catPreview.src = url;
    catPreview.hidden = false;
  } else {
    catPreview.hidden = true;
    catPreview.removeAttribute("src");
  }
});

catFileInput?.addEventListener("change", async () => {
  const file = catFileInput.files?.[0];
  if (!file) return;

  try {
    if (catFormHint) catFormHint.textContent = "Завантажую фото...";
    const url = await uploadImage(file);
    if (catImgInput) catImgInput.value = url;
    if (catPreview) {
      catPreview.src = url;
      catPreview.hidden = false;
    }
    if (catFormHint) catFormHint.textContent = "Фото завантажено.";
  } catch (e) {
    if (catFormHint) catFormHint.textContent = "Помилка: " + e.message;
  }
});

saveCategoryBtn?.addEventListener("click", async () => {
  try {
    const payload = {
      name: String(catNameInput?.value || "").trim(),
      icon: String(catIconInput?.value || "").trim(),
      img: String(catImgInput?.value || "").trim(),
      order: Number(catOrderInput?.value || 9999)
    };

    if (!payload.name) {
      if (catFormHint) catFormHint.textContent = "Введіть назву категорії.";
      return;
    }

    if (catFormHint) catFormHint.textContent = "Зберігаю...";

    if (editingCategoryId) {
      await api(`/categories/${editingCategoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      await api("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    await syncFromApi();
    renderCatalog();
    closeCategoryAdminModal();
  } catch (e) {
    if (catFormHint) catFormHint.textContent = "Помилка: " + e.message;
  }
});

async function deleteCategory(id) {
  if (!isAdmin()) return;
  const ok = confirm("Видалити категорію?");
  if (!ok) return;

  try {
    await api(`/categories/${id}`, { method: "DELETE" });
    await syncFromApi();
    renderCatalog();
    if (activeCatId === id) backToCatalog();
  } catch (e) {
    alert("Помилка: " + e.message);
  }
}

deleteCategoryBtn?.addEventListener("click", async () => {
  if (!editingCategoryId) return;
  await deleteCategory(editingCategoryId);
  closeCategoryAdminModal();
});

/* =========================
   PRODUCT ADMIN MODAL
========================= */
const adminProductOverlay = document.getElementById("adminProductOverlay");
const adminProductModal = document.getElementById("adminProductModal");
const adminProductClose = document.getElementById("adminProductClose");
const adminProductTitle = document.getElementById("adminProductTitle");

const pTitleInput = document.getElementById("pTitleInput");
const pCategoryInput = document.getElementById("pCategoryInput");
const pPriceInput = document.getElementById("pPriceInput");
const pBrandInput = document.getElementById("pBrandInput");
const pUnitInput = document.getElementById("pUnitInput");
const pIdInput = document.getElementById("pIdInput");
const pStockInput = document.getElementById("pStockInput");
const pDescInput = document.getElementById("pDescInput");
const pRelatedInput = document.getElementById("pRelatedInput");
const pImgInput = document.getElementById("pImgInput");
const pFileInput = document.getElementById("pFileInput");
const pPreview = document.getElementById("pPreview");
const saveProductBtn = document.getElementById("saveProductBtn");
const deleteProductBtn = document.getElementById("deleteProductBtn");
const productFormHint = document.getElementById("productFormHint");
const pOrderTypeInput = document.getElementById("pOrderTypeInput");
const pCustomNoteInput = document.getElementById("pCustomNoteInput");

const adminInfoBtn = document.getElementById("adminInfoBtn");
const adminInfoOverlay = document.getElementById("adminInfoOverlay");
const adminInfoModal = document.getElementById("adminInfoModal");
const adminInfoClose = document.getElementById("adminInfoClose");
const infoAdminList = document.getElementById("infoAdminList");
const addInfoCardBtn = document.getElementById("addInfoCardBtn");
const infoAdminHint = document.getElementById("infoAdminHint");

function openInfoAdminModal() {
  if (!isAdmin()) return;
  renderInfoAdminList();
  adminInfoOverlay.hidden = false;
  adminInfoModal.hidden = false;
  adminInfoModal.setAttribute("aria-hidden", "false");
}

function closeInfoAdminModal() {
  adminInfoOverlay.hidden = true;
  adminInfoModal.hidden = true;
  adminInfoModal.setAttribute("aria-hidden", "true");
}

adminInfoBtn?.addEventListener("click", openInfoAdminModal);
adminInfoClose?.addEventListener("click", closeInfoAdminModal);
adminInfoOverlay?.addEventListener("click", closeInfoAdminModal);

function renderInfoAdminList() {
  if (!infoAdminList) return;

  infoAdminList.innerHTML = "";

  HOME_INFO_CARDS.forEach((item, index) => {
    const box = document.createElement("div");
    box.className = "slideAdminCard";
    box.style.marginBottom = "12px";

    box.innerHTML = `
      <div class="slideAdminCard__title">Блок ${index + 1}</div>
      <div class="slideAdminCard__grid">
        <input class="authInput" data-field="title" data-index="${index}" placeholder="Заголовок" value="${escapeHTML(item.title || "")}">
        <textarea class="authInput" data-field="text" data-index="${index}" rows="3" placeholder="Текст">${escapeHTML(item.text || "")}</textarea>
        <div class="slideAdminActions">
          <button class="btnPrimary" data-act="save-info" data-index="${index}" type="button">Зберегти</button>
          <button class="btnDanger" data-act="delete-info" data-index="${index}" type="button">Видалити</button>
        </div>
      </div>
    `;

    infoAdminList.appendChild(box);
  });

  infoAdminList.querySelectorAll('[data-act="save-info"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.index);
      const titleInput = infoAdminList.querySelector(`[data-field="title"][data-index="${index}"]`);
      const textInput = infoAdminList.querySelector(`[data-field="text"][data-index="${index}"]`);

      HOME_INFO_CARDS[index] = {
        title: String(titleInput?.value || "").trim(),
        text: String(textInput?.value || "").trim()
      };

      await saveHomeInfoCardsToBackend();
      renderHomeInfoCards();
      renderInfoAdminList();
      if (infoAdminHint) infoAdminHint.textContent = "Блок збережено.";
    });
  });

  infoAdminList.querySelectorAll('[data-act="delete-info"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.index);
      HOME_INFO_CARDS.splice(index, 1);
      await saveHomeInfoCardsToBackend();
      renderHomeInfoCards();
      renderInfoAdminList();
      if (infoAdminHint) infoAdminHint.textContent = "Блок видалено.";
    });
  });
}

addInfoCardBtn?.addEventListener("click", async () => {
  HOME_INFO_CARDS.push({
    title: "Новий блок",
    text: ""
  });

  await saveHomeInfoCardsToBackend();
  renderHomeInfoCards();
  renderInfoAdminList();
});

saveProductBtn?.addEventListener("click", async () => {
  try {
    const relatedIds = String(pRelatedInput?.value || "")
      .split(",")
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isFinite(x));

    const variants = collectSiteAdminVariants();

    if (!variants.length) {
      if (productFormHint) productFormHint.textContent = "Додай хоча б одне фасування.";
      return;
    }

    for (const v of variants) {
      if (!v.label) {
        if (productFormHint) productFormHint.textContent = "У кожного фасування має бути назва.";
        return;
      }

      if (!Number.isFinite(v.price) || v.price < 0) {
        if (productFormHint) productFormHint.textContent = `Невірна ціна для "${v.label}".`;
        return;
      }

      if (!Number.isFinite(v.stockQty) || v.stockQty < 0) {
        if (productFormHint) productFormHint.textContent = `Невірна кількість для "${v.label}".`;
        return;
      }
    }

    const payload = {
      title: String(pTitleInput?.value || "").trim(),
      catId: Number(pCategoryInput?.value),
      brand: String(pBrandInput?.value || "").trim(),
      description: String(pDescInput?.value || "").trim(),
      img: String(pImgInput?.value || "").trim(),
      relatedIds,
      isCustomOrder: pOrderTypeInput?.value === "custom" ? 1 : 0,
      customNotePlaceholder: String(pCustomNoteInput?.value || "").trim(),
      isActive: 1,
      variants
    };

    if (!payload.title) {
      if (productFormHint) productFormHint.textContent = "Введіть назву товару.";
      return;
    }

    if (!Number.isFinite(payload.catId) || payload.catId <= 0) {
      if (productFormHint) productFormHint.textContent = "Оберіть категорію.";
      return;
    }

    if (!payload.brand) {
      if (productFormHint) productFormHint.textContent = "Введіть виробника.";
      return;
    }

    if (productFormHint) productFormHint.textContent = "Зберігаю...";

    if (editingProductId) {
      await api(`/products/${editingProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      await api("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    await syncFromApi();
    closeProductAdminModal();

    if (activeCatId) {
      const list = getProds().filter((p) => Number(p.catId) === Number(activeCatId));
      renderProducts(list, catById(getCats(), activeCatId)?.name || "Товари");
    } else {
      renderCatalog();
    }

    if (editingProductId) {
      const updated = getProds().find((p) => Number(p.id) === Number(editingProductId));
      if (updated) currentProduct = updated;
    }
  } catch (e) {
    if (productFormHint) productFormHint.textContent = "Помилка: " + e.message;
  }
});

/* =========================
   EVENTS
========================= */
backToCatalogBtn?.addEventListener("click", backToCatalog);

applyFiltersBtn?.addEventListener("click", () => {
  if (!activeCatId) return;
  const list = getProds().filter((p) => Number(p.catId) === Number(activeCatId));
  renderProducts(applyFiltersToList(list), catById(getCats(), activeCatId)?.name || "Товари");
});

resetFiltersBtn?.addEventListener("click", () => {
  if (!activeCatId) return;
  const list = getProds().filter((p) => Number(p.catId) === Number(activeCatId));
  resetFiltersUI(list);
  renderProducts(list, catById(getCats(), activeCatId)?.name || "Товари");
});

searchInput?.addEventListener("input", () => showSuggestions(findProductsByQuery(searchInput.value)));

document.addEventListener("click", (e) => {
  if (suggestions && !e.target.closest(".mobileHeader__search")) suggestions.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (authModal && !authModal.hidden) closeAuth();
    closeDrawer();
    hideAddedModal();
    closeCategoryAdminModal();
    closeProductAdminModal();
    closeSlidesAdminModal();
    closeProductModal();
  }
});

mClose?.addEventListener("click", closeProductModal);
modalOverlay?.addEventListener("click", closeProductModal);

mMinus?.addEventListener("click", () => {
  if (!currentProduct || !mQty) return;

  const step = Number(mQty.step) || 1;
  const min = Number(mQty.min) || step;
  const max = currentProduct.unitType === "pcs" ? Number(currentProduct.stockQty || 0) : Infinity;

  let v = Number(mQty.value);
  v = clamp(v - step, min, max);
  if (currentProduct.unitType !== "pcs") v = round1(v);

  mQty.value = String(v);
});

mPlus?.addEventListener("click", () => {
  if (!currentProduct || !mQty) return;

  const step = Number(mQty.step) || 1;
  const min = Number(mQty.min) || step;
  const max = currentProduct.unitType === "pcs" ? Number(currentProduct.stockQty || 0) : Infinity;

  let v = Number(mQty.value);
  v = clamp(v + step, min, max);
  if (currentProduct.unitType !== "pcs") v = round1(v);

  mQty.value = String(v);
});

mAdd?.addEventListener("click", () => {
  if (!currentProduct) return;
  if (!isInStock(currentProduct)) return;

  let qty = Number(mQty?.value);
  if (!(qty > 0)) return;

  if (currentProduct.unitType === "pcs") {
    const max = Number(currentProduct.stockQty || 0);
    qty = clamp(qty, 1, max);
    qty = Math.round(qty);
  } else {
    qty = round1(qty);
  }

  const unit = mUnit?.value || currentProduct.unit || "шт";
  const key = `${currentProduct.id}|${unit}`;
  const cart = getCart();

  cart[key] = round1((cart[key] || 0) + qty);
  setCart(cart);

  updateCartBadge();
  closeProductModal();
  showAddedModal(currentProduct, qty, unit);
});

prevSlideBtn?.addEventListener("click", () => goToSlide(sliderIndex - 1, true));
nextSlideBtn?.addEventListener("click", () => goToSlide(sliderIndex + 1, true));

const sliderRoot = document.getElementById("slider");

sliderRoot?.addEventListener("mouseenter", stopAutoSlider);
sliderRoot?.addEventListener("mouseleave", startAutoSlider);
sliderRoot?.addEventListener("touchstart", stopAutoSlider, { passive: true });
sliderRoot?.addEventListener("touchend", startAutoSlider);

/* =========================
   SYNC
========================= */
async function syncFromApi() {
  try {
    const catsRes = await fetch(`${API_BASE}/api/categories`);
    if (catsRes.ok) {
      const cats = await catsRes.json().catch(() => []);
      if (Array.isArray(cats)) setCats(cats);
    }
  } catch (e) {
    console.warn("categories sync failed:", e);
  }

  try {
    const prodsRes = await fetch(`${API_BASE}/api/products`);
    if (prodsRes.ok) {
      const prods = await prodsRes.json().catch(() => []);
      if (Array.isArray(prods)) setProds(prods);
    }
  } catch (e) {
    console.warn("products sync failed:", e);
  }
}

const homeInfoCards = document.getElementById("homeInfoCards");

function renderHomeInfoCards() {
  if (!homeInfoCards) return;

  homeInfoCards.innerHTML = "";

  HOME_INFO_CARDS.forEach((item) => {
    const card = document.createElement("div");
    card.className = "infoCard reveal";
    card.style.marginBottom = "10px";

    card.innerHTML = `
      <h3 class="sectionTitle" style="font-size:18px; margin-bottom:6px;">${escapeHTML(item.title || "")}</h3>
      <p class="hint" style="font-size:16px;">${escapeHTML(item.text || "")}</p>
    `;

    homeInfoCards.appendChild(card);
  });
}

async function saveHomeInfoCardsToBackend() {
  await api("/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homeInfoCards: HOME_INFO_CARDS })
  });
}

/* =========================
   INIT
========================= */
(async function init() {
  seedIfEmpty();
  migrateProductsIfNeeded();
  migrateCategoriesIfNeeded();

  try {
    await syncFromApi();
  } catch (e) {
    console.error("syncFromApi failed:", e);
  }

  try {
    await loadSettingsFromBackend();
  } catch (e) {
    console.error("loadSettingsFromBackend failed:", e);
  }

  applyHeaderSettings();
  renderCatalog();
  renderSlider();
  renderHomeInfoCards();
  updateCartBadge();
  refreshAuthUI();
  initReveal();

  if (productsSection) productsSection.hidden = true;
})();