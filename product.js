"use strict";

const API_BASE = window.API_BASE || "http://localhost:3001";

const KEY_PRODS = "products_db";
const KEY_CATS = "categories_db";
const KEY_CART = "cart_v2";

/* =========================
   HELPERS
========================= */
function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getProds() {
  return safeParse(localStorage.getItem(KEY_PRODS), []);
}

function setProds(list) {
  localStorage.setItem(KEY_PRODS, JSON.stringify(Array.isArray(list) ? list : []));
}

function getCats() {
  return safeParse(localStorage.getItem(KEY_CATS), []);
}

function setCart(obj) {
  localStorage.setItem(KEY_CART, JSON.stringify(obj || {}));
}

function getCart() {
  return safeParse(localStorage.getItem(KEY_CART), {});
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function priceUnitText(product) {
  const unit = String(product?.unit || "").trim();
  return unit ? `за ${unit}` : "за шт";
}

function formatQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function stepByUnitType(unitType) {
  return unitType === "length" || unitType === "weight" ? 0.1 : 1;
}

function unitsForProduct(product) {
  if (product?.unit) return [product.unit];
  if (product?.unitType === "length") return ["м"];
  if (product?.unitType === "weight") return ["кг"];
  return ["шт"];
}

function isInStock(p) {
  return Number(p?.stockQty || 0) > 0;
}

function catById(cats, id) {
  return cats.find((c) => Number(c.id) === Number(id));
}

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("id"));
}

function cartUniqueProductsCount() {
  const cart = getCart();
  const ids = new Set(Object.keys(cart).map((k) => String(k).split("|")[0]));
  return ids.size;
}

function productImageSrc(p) {
  return p?.img
    ? p.img
    : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='420' viewBox='0 0 600 420'><rect width='600' height='420' fill='%23eef2f7'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='28'>Немає фото</text></svg>";
}

const KEY_SESSION = "current_user";
const KEY_ADMIN_TOKEN = "admin_token";

function getSession() {
  return safeParse(localStorage.getItem(KEY_SESSION), null);
}

function getAdminToken() {
  return localStorage.getItem(KEY_ADMIN_TOKEN) || "";
}

function isAdmin() {
  const u = getSession();
  return Boolean(getAdminToken()) && u?.role === "admin";
}

async function api(path, options = {}) {
  const token = getAdminToken();

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" ? data : "") ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/* =========================
   DOM
========================= */
const cartCount = document.getElementById("cartCount");

const productImg = document.getElementById("productImg");
const productTitle = document.getElementById("productTitle");
const productPageTitleTop = document.getElementById("productPageTitleTop");
const productMeta = document.getElementById("productMeta");
const productPrice = document.getElementById("productPrice");
const productCode = document.getElementById("productCode");
const productDescription = document.getElementById("productDescription");
const productHint = document.getElementById("productHint");
const productBackBtn = document.getElementById("productBackBtn");
const productEditBtn = document.getElementById("productEditBtn");
const productDeleteBtn = document.getElementById("productDeleteBtn");

const pMinus = document.getElementById("pMinus");
const pPlus = document.getElementById("pPlus");
const pQty = document.getElementById("pQty");
const pUnit = document.getElementById("pUnit");
const addToCartBtn = document.getElementById("addToCartBtn");


const relatedGrid = document.getElementById("relatedGrid");

let CURRENT_PRODUCT = null;

productEditBtn?.addEventListener("click", () => {
  if (!CURRENT_PRODUCT || !isAdmin()) return;
  openProductAdminModal(CURRENT_PRODUCT);
});

productDeleteBtn?.addEventListener("click", async () => {
  if (!CURRENT_PRODUCT || !isAdmin()) return;

  const ok = confirm("Видалити товар?");
  if (!ok) return;

  try {
    await api(`/products/${CURRENT_PRODUCT.id}`, { method: "DELETE" });
    goBackSmart();
  } catch (err) {
    alert("Помилка: " + err.message);
  }
});


function goBackSmart() {
  if (document.referrer && document.referrer !== window.location.href) {
    history.back();
    return;
  }
  window.location.href = "index.html";
}

productBackBtn?.addEventListener("click", goBackSmart);

let editingProductId = null;

const adminProductOverlay = document.getElementById("adminProductOverlay");
const adminProductModal = document.getElementById("adminProductModal");
const adminProductClose = document.getElementById("adminProductClose");
const adminProductTitle = document.getElementById("adminProductTitle");

const pTitleInput = document.getElementById("pTitleInput");
const pCategoryInput = document.getElementById("pCategoryInput");
const pPriceInput = document.getElementById("pPriceInput");
const pBrandInput = document.getElementById("pBrandInput");
const pUnitInput = document.getElementById("pUnitInput");
const pStockInput = document.getElementById("pStockInput");
const pDescInput = document.getElementById("pDescInput");
const pImgInput = document.getElementById("pImgInput");
const pFileInput = document.getElementById("pFileInput");
const pPreview = document.getElementById("pPreview");
const saveProductBtn = document.getElementById("saveProductBtn");
const deleteProductBtn = document.getElementById("deleteProductBtn");
const productFormHint = document.getElementById("productFormHint");
const productCustomBadge = document.getElementById("productCustomBadge");
const productCustomHint = document.getElementById("productCustomHint");
const productCustomNoteLabel = document.getElementById("productCustomNoteLabel");
const productCustomNote = document.getElementById("productCustomNote");
const pOrderTypeInput = document.getElementById("pOrderTypeInput");
const pRelatedInput = document.getElementById("pRelatedInput");
const pIdInput = document.getElementById("pIdInput");


function fillProductCategorySelect(selectedId = null) {
  const cats = getCats().slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "uk", { sensitivity: "base" })
  );

  pCategoryInput.innerHTML = "";

  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = c.name;
    if (Number(selectedId) === Number(c.id)) opt.selected = true;
    pCategoryInput.appendChild(opt);
  });
}

function openProductAdminModal(product) {
  if (!isAdmin()) return;

  editingProductId = product?.id || null;
  adminProductTitle.textContent = "Редагувати товар";

  fillProductCategorySelect(product?.catId || null);

  pTitleInput.value = product?.title || "";
  pPriceInput.value = product ? Number(product.price).toFixed(2) : "";
  pBrandInput.value = product?.brand || "";
  pUnitInput.value = product?.unit || "";
  pStockInput.value = product ? String(product.stockQty ?? 0) : "0";
  pDescInput.value = product?.description || "";
  pImgInput.value = product?.img || "";
  pFileInput.value = "";
  productFormHint.textContent = "";

  if (pIdInput) {
    pIdInput.value = product?.id ?? "";
  }

  if (pOrderTypeInput) {
    pOrderTypeInput.value = Number(product?.isCustomOrder || 0) === 1 ? "custom" : "stock";
  }

  if (pRelatedInput) {
    pRelatedInput.value = Array.isArray(product?.relatedIds)
      ? product.relatedIds.join(",")
      : "";
  }

  if (product?.img) {
    pPreview.src = product.img;
    pPreview.hidden = false;
  } else {
    pPreview.hidden = true;
    pPreview.removeAttribute("src");
  }

  adminProductOverlay.hidden = false;
  adminProductModal.hidden = false;
}

function closeProductAdminModal() {
  adminProductModal.setAttribute("aria-hidden", "true");
  adminProductOverlay.hidden = true;
  adminProductModal.hidden = true;
  editingProductId = null;
  productFormHint.textContent = "";
}

adminProductClose?.addEventListener("click", closeProductAdminModal);
adminProductOverlay?.addEventListener("click", closeProductAdminModal);

pImgInput?.addEventListener("input", () => {
  const url = (pImgInput.value || "").trim();
  if (url) {
    pPreview.src = url;
    pPreview.hidden = false;
  } else {
    pPreview.hidden = true;
  }
});

async function uploadImage(file) {
  const token = getAdminToken();
  const form = new FormData();
  form.append("image", file);

  const res = await fetch(`${API_BASE}/api/media/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data?.url || "";
}

pFileInput?.addEventListener("change", async () => {
  const file = pFileInput.files?.[0];
  if (!file) return;

  try {
    productFormHint.textContent = "Завантажую фото...";
    const url = await uploadImage(file);
    pImgInput.value = url;
    pPreview.src = url;
    pPreview.hidden = false;
    productFormHint.textContent = "Фото завантажено.";
  } catch (e) {
    productFormHint.textContent = "Помилка: " + e.message;
  }
});

saveProductBtn?.addEventListener("click", async () => {
  if (!editingProductId) return;

  try {
    const relatedIds = String(pRelatedInput?.value || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Number.isFinite);

    const payload = {
      title: String(pTitleInput.value || "").trim(),
      catId: Number(pCategoryInput.value),
      price: Number(pPriceInput.value),
      brand: String(pBrandInput.value || "").trim(),
      unit: String(pUnitInput.value || "").trim() || "шт",
      unitType: "pcs",
      stockQty: Number(pStockInput.value || 0),
      description: String(pDescInput.value || "").trim(),
      img: String(pImgInput.value || "").trim(),
      isActive: 1,
      isCustomOrder: pOrderTypeInput?.value === "custom" ? 1 : 0,
      relatedIds
    };

    if (!payload.title) {
      productFormHint.textContent = "Введіть назву товару.";
      return;
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      productFormHint.textContent = "Невірна ціна.";
      return;
    }

    productFormHint.textContent = "Зберігаю...";

    await api(`/products/${editingProductId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

await syncProductsFromApi();

const updated = getProds().find((x) => Number(x.id) === Number(editingProductId));
if (updated) {
  renderProduct(updated);
}

closeProductAdminModal();
  } catch (e) {
    productFormHint.textContent = "Помилка: " + e.message;
  }
});

deleteProductBtn?.addEventListener("click", async () => {
  if (!editingProductId) return;

  const ok = confirm("Видалити товар?");
  if (!ok) return;

  try {
    await api(`/products/${editingProductId}`, { method: "DELETE" });
    await syncProductsFromApi();
    closeProductAdminModal();
    goBackSmart();
  } catch (e) {
    productFormHint.textContent = "Помилка: " + e.message;
  }
});

/* =========================
   UI
========================= */
function updateCartBadge() {
  if (cartCount) cartCount.textContent = String(cartUniqueProductsCount());
}

function fillUnits(product) {
  if (!pUnit) return;
  pUnit.innerHTML = "";

  unitsForProduct(product).forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    pUnit.appendChild(opt);
  });
}

function setupQty(product) {
  
  if (!pQty) return;
  if (Number(product.isCustomOrder || 0) === 1) {
  pQty.step = "1";
  pQty.min = "1";
  pQty.value = "1";
  pQty.removeAttribute("max");
  return;
}

  if (product.unitType === "length" || product.unitType === "weight") {
    pQty.step = "0.1";
    pQty.min = "0.1";
    pQty.value = "1";
  } else {
    pQty.step = "1";
    pQty.min = "1";
    pQty.value = "1";
  }

  if (product.unitType === "pcs") {
    const max = Number(product.stockQty || 0);
    if (max > 0) {
      pQty.max = String(max);
    } else {
      pQty.removeAttribute("max");
    }
  } else {
    pQty.removeAttribute("max");
  }
}

function renderProduct(product) {
  const isCustom = Number(product.isCustomOrder || 0) === 1;

if (productCustomBadge) productCustomBadge.hidden = !isCustom;
if (productCustomHint) productCustomHint.hidden = !isCustom;
if (productCustomNoteLabel) productCustomNoteLabel.hidden = !isCustom;

if (productCustomNote) {
  productCustomNote.hidden = !isCustom;
  productCustomNote.placeholder = product.customNotePlaceholder || "Вкажіть уточнення до замовлення";
}
  const cats = getCats();
  const cat = catById(cats, product.catId);

  CURRENT_PRODUCT = product;

  if (productEditBtn) productEditBtn.hidden = !isAdmin();
if (productDeleteBtn) productDeleteBtn.hidden = !isAdmin();



  if (productImg) {
    productImg.src = productImageSrc(product);
    productImg.alt = product.title || "Товар";
  }

  if (productTitle) productTitle.textContent = product.title || "Товар";
  if (productPageTitleTop) productPageTitleTop.textContent = "Товар";
  document.title = `${product.title || "Товар"} — БудМаркет`;

const stockText = isCustom
  ? "Під замовлення"
  : isInStock(product)
    ? `В наявності: ${product.stockQty}`
    : "Немає в наявності";
    if (productHint) {
  productHint.textContent = isCustom
    ? "Цей товар доступний під замовлення. За деталями зверніться до консультанта."
    : isInStock(product)
      ? ""
      : "Цього товару зараз немає в наявності.";
}

if (addToCartBtn) {
  addToCartBtn.disabled = !isCustom && !isInStock(product);
}

  if (productMeta) {
    productMeta.textContent = `${cat ? cat.name : "Категорія"} • ${product.brand || "Без бренду"} • ${stockText}`;
  }

if (productPrice) {
  productPrice.textContent = `${formatPrice(product.price)} ₴ ${priceUnitText(product)}`;
}

if (productCode) {
  if (isAdmin()) {
    productCode.textContent = `ID товару: ${product.id ?? "—"}`;
    productCode.hidden = false;
  } else {
    productCode.hidden = true;
  }
}

  if (productDescription) {
    productDescription.textContent = product.description?.trim()
      ? product.description
      : "Опис відсутній.";
  }

if (productHint) {
  productHint.textContent = isCustom
    ? "Цей товар доступний під замовлення. За деталями зверніться до консультанта."
    : isInStock(product)
      ? ""
      : "Цього товару зараз немає в наявності.";
}


  fillUnits(product);
  setupQty(product);
  renderRelated(product);
}

function renderRelated(product) {
  if (!relatedGrid) return;

  const prods = getProds();
  let related = [];

  if (Array.isArray(product.relatedIds) && product.relatedIds.length) {
    related = prods.filter((p) => product.relatedIds.includes(Number(p.id)) && Number(p.id) !== Number(product.id));
  }

  if (!related.length) {
    related = prods
      .filter((p) => Number(p.catId) === Number(product.catId) && Number(p.id) !== Number(product.id))
      .slice(0, 4);
  }

  related = related.sort((a, b) =>
  String(a.title || "").localeCompare(String(b.title || ""), "uk", { sensitivity: "base" })
);

  relatedGrid.innerHTML = "";

  if (!related.length) {
    relatedGrid.innerHTML = `<div class="hint">Схожих товарів поки немає.</div>`;
    return;
  }

  related.forEach((p) => {
    const card = document.createElement("article");
    card.className = "prodCard";

    card.innerHTML = `
      <div class="prodCard__main">
        <img class="prodImg" src="${escapeHTML(productImageSrc(p))}" alt="${escapeHTML(p.title)}">
        <div class="prodBody">
          <h3 class="prodTitle">${escapeHTML(p.title)}</h3>
          <p class="prodMeta">
            ${escapeHTML(p.brand || "")}${p.brand ? " • " : ""}${escapeHTML(priceUnitText(p))}
          </p>
          <div class="prodBottom">
            <div class="prodPrice">${formatPrice(p.price)} ₴</div>
          </div>
          ${isAdmin() ? `<button class="btnDanger relatedDeleteBtn" type="button" data-id="${p.id}">Видалити</button>` : ""}
        </div>
      </div>
    `;

    card.querySelector(".prodCard__main")?.addEventListener("click", (e) => {
      if (e.target.closest(".relatedDeleteBtn")) return;
      window.location.href = `product.html?id=${p.id}`;
    });

    const relatedDeleteBtn = card.querySelector(".relatedDeleteBtn");
    relatedDeleteBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const ok = confirm(`Видалити товар "${p.title}"?`);
      if (!ok) return;

      try {
        await api(`/products/${p.id}`, { method: "DELETE" });
        await syncProductsFromApi();

        const freshCurrent = getProds().find((x) => Number(x.id) === Number(product.id));
        if (freshCurrent) {
          renderRelated(freshCurrent);
        } else {
          goBackSmart();
        }
      } catch (err) {
        alert("Помилка: " + err.message);
      }
    });

    relatedGrid.appendChild(card);
  });
}

/* =========================
   CART
========================= */
function addCurrentProductToCart() {
  if (!CURRENT_PRODUCT) return;

  const isCustom = Number(CURRENT_PRODUCT.isCustomOrder || 0) === 1;
  if (!isCustom && !isInStock(CURRENT_PRODUCT)) return;

  let qty = Number(pQty?.value);
  if (!(qty > 0)) return;

if (!isCustom && CURRENT_PRODUCT.unitType === "pcs") {
  const max = Number(CURRENT_PRODUCT.stockQty || 0);
  qty = clamp(qty, 1, max);
  qty = Math.round(qty);
} else if (CURRENT_PRODUCT.unitType === "pcs") {
  qty = Math.max(1, Math.round(qty));
} else {
  qty = round1(qty);
}
  const customNoteText = productCustomNote?.value?.trim() || "";

  const unit = pUnit?.value || CURRENT_PRODUCT.unit || "шт";
const key = `${CURRENT_PRODUCT.id}|${unit}|${customNoteText}`;

  const cart = getCart();
  cart[key] = round1((cart[key] || 0) + qty);
  setCart(cart);
  updateCartBadge();

if (productHint) {
  productHint.textContent = isCustom
    ? `Додано в кошик: ${formatQty(qty)} ${unit}. Уточнення збережено.`
    : `Додано в кошик: ${formatQty(qty)} ${unit}`;
}
}

/* =========================
   API
========================= */
async function syncProductsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const prods = await res.json();
    if (Array.isArray(prods)) setProds(prods);
  } catch (e) {
    console.warn("Не вдалося оновити товари з API:", e);
  }
}

/* =========================
   EVENTS
========================= */
pMinus?.addEventListener("click", () => {
  if (!CURRENT_PRODUCT || !pQty) return;

  const step = Number(pQty.step) || 1;
  const min = Number(pQty.min) || step;
  const max = CURRENT_PRODUCT.unitType === "pcs"
    ? Number(CURRENT_PRODUCT.stockQty || 0)
    : Infinity;

  let v = Number(pQty.value);
  v = clamp(v - step, min, max);

  if (CURRENT_PRODUCT.unitType !== "pcs") v = round1(v);
  pQty.value = String(v);
});

pPlus?.addEventListener("click", () => {
  if (!CURRENT_PRODUCT || !pQty) return;

  const step = Number(pQty.step) || 1;
  const min = Number(pQty.min) || step;
  const max = CURRENT_PRODUCT.unitType === "pcs"
    ? Number(CURRENT_PRODUCT.stockQty || 0)
    : Infinity;

  let v = Number(pQty.value);
  v = clamp(v + step, min, max);

  if (CURRENT_PRODUCT.unitType !== "pcs") v = round1(v);
  pQty.value = String(v);
});

addToCartBtn?.addEventListener("click", addCurrentProductToCart);

/* =========================
   INIT
========================= */
(async function initProductPage() {
  updateCartBadge();

  await syncProductsFromApi();

  const productId = getProductIdFromUrl();
  const prods = getProds();

  if (!Number.isFinite(productId) || productId <= 0) {
    if (productTitle) productTitle.textContent = "Товар не знайдено";
    if (productMeta) productMeta.textContent = "Некоректне посилання на товар.";
    if (productPrice) productPrice.textContent = "0.00 ₴";
    if (productDescription) productDescription.textContent = "У URL немає правильного id товару.";
    if (relatedGrid) relatedGrid.innerHTML = "";
    return;
  }

  const product = prods.find((p) => Number(p.id) === Number(productId));

  if (!product) {
    if (productTitle) productTitle.textContent = "Товар не знайдено";
    if (productMeta) productMeta.textContent = "Такий товар відсутній у базі.";
    if (productPrice) productPrice.textContent = "0.00 ₴";
    if (productDescription) productDescription.textContent = "Можливо, товар був видалений або ще не завантажився.";
    if (relatedGrid) relatedGrid.innerHTML = "";
    return;
  }

  renderProduct(product);
})();