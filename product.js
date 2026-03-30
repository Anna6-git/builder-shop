"use strict";

const API_BASE = window.API_BASE || "http://localhost:3001";

const KEY_PRODS = "products_db";
const KEY_CATS = "categories_db";
const KEY_CART = "cart_v2";
const KEY_SESSION = "current_user";
const KEY_ADMIN_TOKEN = "admin_token";

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

function setCats(list) {
  localStorage.setItem(KEY_CATS, JSON.stringify(Array.isArray(list) ? list : []));
}

function getCart() {
  return safeParse(localStorage.getItem(KEY_CART), {});
}

function setCart(obj) {
  localStorage.setItem(KEY_CART, JSON.stringify(obj || {}));
}

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

function formatQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
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

function normalizeVariantsForClient(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  if (variants.length) {
    return variants
      .map((v, index) => ({
        id: Number.isFinite(Number(v?.id)) ? Number(v.id) : index,
        label: String(v?.label || "").trim(),
        price: Number(v?.price),
        stockQty: Number(v?.stockQty ?? 0),
        sortOrder: Number.isFinite(Number(v?.sortOrder)) ? Number(v.sortOrder) : index,
      }))
      .filter(
        (v) =>
          v.label &&
          Number.isFinite(v.price) &&
          v.price >= 0 &&
          Number.isFinite(v.stockQty) &&
          v.stockQty >= 0
      );
  }

  const fallbackLabel = String(product?.unit || "").trim();
  const fallbackPrice = Number(product?.price);
  const fallbackStock = Number(product?.stockQty ?? 0);

  if (
    fallbackLabel &&
    Number.isFinite(fallbackPrice) &&
    fallbackPrice >= 0 &&
    Number.isFinite(fallbackStock) &&
    fallbackStock >= 0
  ) {
    return [
      {
        id: 0,
        label: fallbackLabel,
        price: fallbackPrice,
        stockQty: fallbackStock,
        sortOrder: 0,
      },
    ];
  }

  return [];
}

function firstVariant(product) {
  const variants = normalizeVariantsForClient(product);
  return variants.length ? variants[0] : null;
}

function productCardPriceText(product) {
  const v = firstVariant(product);
  return formatPrice(v ? v.price : product?.price || 0);
}

function productCardUnitText(product) {
  const v = firstVariant(product);
  return v?.label || product?.unit || "шт";
}

/* =========================
   API
========================= */
async function api(path, options = {}) {
  const token = getAdminToken();

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

async function syncProductsFromApi() {
  const prods = await api("/products", { method: "GET" });
  if (Array.isArray(prods)) setProds(prods);
}

async function syncCategoriesFromApi() {
  try {
    const cats = await api("/categories", { method: "GET" });
    if (Array.isArray(cats)) setCats(cats);
  } catch (e) {
    console.warn("Не вдалося оновити категорії:", e);
  }
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
const addRelatedProductBtn = document.getElementById("addRelatedProductBtn");
const relatedPickerOverlay = document.getElementById("relatedPickerOverlay");
const relatedPickerModal = document.getElementById("relatedPickerModal");
const relatedPickerClose = document.getElementById("relatedPickerClose");
const relatedPickerSearch = document.getElementById("relatedPickerSearch");
const relatedPickerHint = document.getElementById("relatedPickerHint");
const relatedPickerResults = document.getElementById("relatedPickerResults");

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

let CURRENT_PRODUCT = null;
let editingProductId = null;

/* =========================
   ADMIN VARIANTS UI
========================= */
function ensureVariantEditorInModal() {
  if (!adminProductModal) return null;

  let box = document.getElementById("adminVariantsBox");
  if (box) return box;

  const mountAfter = pStockInput?.parentElement || pStockInput || pUnitInput;
  if (!mountAfter) return null;

  box = document.createElement("div");
  box.id = "adminVariantsBox";
  box.style.marginTop = "14px";
  box.innerHTML = `
    <label class="authLabel">Фасування</label>
    <div id="adminVariantRows" style="display:flex; flex-direction:column; gap:10px; margin-top:8px;"></div>
    <button class="btn" id="adminAddVariantBtn" type="button" style="margin-top:10px;">+ Додати фасування</button>
  `;

  const stockLabel = pStockInput?.previousElementSibling;
  if (stockLabel && stockLabel.parentElement) {
    stockLabel.insertAdjacentElement("beforebegin", box);
  } else if (mountAfter.parentElement) {
    mountAfter.parentElement.insertBefore(box, mountAfter);
  }

  const addBtn = document.getElementById("adminAddVariantBtn");
  addBtn?.addEventListener("click", () => {
    const rows = document.getElementById("adminVariantRows");
    rows?.appendChild(createAdminVariantRow());
    syncLegacyFieldsFromAdminVariants();
  });

  return box;
}

function createAdminVariantRow(label = "", price = "", stockQty = "") {
  const row = document.createElement("div");
  row.className = "adminVariantRow";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1.4fr 1fr 1fr auto";
  row.style.gap = "8px";
  row.innerHTML = `
    <input class="authInput" data-field="label" placeholder="Фасування, напр. 0.9кг" value="${escapeHTML(label)}">
    <input class="authInput" data-field="price" type="number" step="0.01" min="0" placeholder="Ціна" value="${escapeHTML(price)}">
    <input class="authInput" data-field="stockQty" type="number" step="0.1" min="0" placeholder="Кількість" value="${escapeHTML(stockQty)}">
    <button class="btnDanger" type="button" data-act="removeVariant">×</button>
  `;

  row.addEventListener("input", syncLegacyFieldsFromAdminVariants);

  row.addEventListener("click", (e) => {
    const act = e.target?.dataset?.act;
    if (act !== "removeVariant") return;

    const rows = document.getElementById("adminVariantRows");
    row.remove();

    if (rows && !rows.children.length) {
      rows.appendChild(createAdminVariantRow());
    }

    syncLegacyFieldsFromAdminVariants();
  });

  return row;
}

function fillAdminVariantRows(variants) {
  ensureVariantEditorInModal();

  const rows = document.getElementById("adminVariantRows");
  if (!rows) return;

  rows.innerHTML = "";

  const list = Array.isArray(variants) && variants.length
    ? variants
    : [firstVariant(CURRENT_PRODUCT || {})].filter(Boolean);

  if (list.length) {
    list.forEach((v) => {
      rows.appendChild(
        createAdminVariantRow(
          v?.label || "",
          Number.isFinite(Number(v?.price)) ? String(v.price) : "",
          Number.isFinite(Number(v?.stockQty)) ? String(v.stockQty) : ""
        )
      );
    });
  } else {
    rows.appendChild(createAdminVariantRow());
  }

  syncLegacyFieldsFromAdminVariants();
}

function collectAdminVariants() {
  const rows = Array.from(document.querySelectorAll("#adminVariantRows .adminVariantRow"));

  return rows
    .map((row, index) => {
      const label = row.querySelector('[data-field="label"]')?.value?.trim() || "";
      const price = Number(row.querySelector('[data-field="price"]')?.value);
      const stockQty = Number(row.querySelector('[data-field="stockQty"]')?.value || 0);

      return {
        label,
        price,
        stockQty,
        sortOrder: index,
      };
    })
    .filter(
      (v) =>
        v.label ||
        Number.isFinite(v.price) ||
        Number.isFinite(v.stockQty)
    );
}

function syncLegacyFieldsFromAdminVariants() {
  const variants = collectAdminVariants();

  if (pPriceInput) {
    pPriceInput.value = variants.length && Number.isFinite(Number(variants[0].price))
      ? String(variants[0].price)
      : "";
  }

  if (pUnitInput) {
    pUnitInput.value = variants.length
      ? variants.map((v) => v.label).filter(Boolean).join(" / ")
      : "";
  }

  if (pStockInput) {
    const total = variants.reduce((sum, v) => sum + Number(v.stockQty || 0), 0);
    pStockInput.value = variants.length ? String(total) : "";
  }
}

/* =========================
   BASIC UI
========================= */
function updateCartBadge() {
  if (cartCount) {
    cartCount.textContent = String(cartUniqueProductsCount());
  }
}

function goBackSmart() {
  if (document.referrer && document.referrer !== window.location.href) {
    history.back();
    return;
  }
  window.location.href = "index.html";
}

productBackBtn?.addEventListener("click", goBackSmart);

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

productEditBtn?.addEventListener("click", () => {
  if (!CURRENT_PRODUCT || !isAdmin()) return;
  openProductAdminModal(CURRENT_PRODUCT);
});

/* =========================
   RELATED PICKER
========================= */
function closeRelatedPicker() {
  relatedPickerModal?.setAttribute("aria-hidden", "true");
  if (relatedPickerOverlay) relatedPickerOverlay.hidden = true;
  if (relatedPickerModal) relatedPickerModal.hidden = true;
  if (relatedPickerSearch) relatedPickerSearch.value = "";
  if (relatedPickerHint) relatedPickerHint.textContent = "";
  if (relatedPickerResults) relatedPickerResults.innerHTML = "";
}

function openRelatedPicker() {
  if (!isAdmin() || !CURRENT_PRODUCT) return;

  relatedPickerModal?.setAttribute("aria-hidden", "false");
  if (relatedPickerOverlay) relatedPickerOverlay.hidden = false;
  if (relatedPickerModal) relatedPickerModal.hidden = false;
  if (relatedPickerSearch) relatedPickerSearch.value = "";
  if (relatedPickerHint) relatedPickerHint.textContent = "";
  renderRelatedPickerResults("");
  setTimeout(() => relatedPickerSearch?.focus(), 50);
}

addRelatedProductBtn?.addEventListener("click", openRelatedPicker);
relatedPickerClose?.addEventListener("click", closeRelatedPicker);
relatedPickerOverlay?.addEventListener("click", closeRelatedPicker);

relatedPickerSearch?.addEventListener("input", () => {
  renderRelatedPickerResults(relatedPickerSearch.value);
});

function renderRelatedPickerResults(query) {
  if (!relatedPickerResults || !CURRENT_PRODUCT) return;

  const currentId = Number(CURRENT_PRODUCT.id);
  const q = String(query || "").trim().toLowerCase();
  const all = getProds().filter((p) => Number(p.id) !== currentId);

  let list = all;
  if (q) {
    const qNum = Number(q);
    list = all.filter((p) => {
      const byId = Number.isFinite(qNum) && Number(p.id) === qNum;
      const byTitle = String(p.title || "").toLowerCase().includes(q);
      return byId || byTitle;
    });
  }

  list = list.slice(0, 20);
  relatedPickerResults.innerHTML = "";

  if (!list.length) {
    relatedPickerResults.innerHTML = `<div class="hint">Нічого не знайдено.</div>`;
    return;
  }

  list.forEach((p) => {
    const row = document.createElement("div");
    row.className = "adminRow";

    const alreadyAdded =
      Array.isArray(CURRENT_PRODUCT.relatedIds) &&
      CURRENT_PRODUCT.relatedIds.includes(Number(p.id));

    row.innerHTML = `
      <div>
        <div style="font-weight:900">${escapeHTML(p.title || "")}</div>
        <div style="font-size:12px;color:#6b7280">
          ID: ${p.id}${p.brand ? ` • ${escapeHTML(p.brand)}` : ""}${Number.isFinite(Number(productCardPriceText(p))) ? ` • ${productCardPriceText(p)} ₴` : ""}
        </div>
      </div>
      <button class="btnPrimary" type="button" data-add-id="${p.id}" ${alreadyAdded ? "disabled" : ""}>
        ${alreadyAdded ? "Уже додано" : "Додати"}
      </button>
    `;

    relatedPickerResults.appendChild(row);
  });
}

relatedPickerResults?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-add-id]");
  if (!btn) return;

  const relatedId = Number(btn.dataset.addId);
  if (!Number.isFinite(relatedId)) return;

  if (!CURRENT_PRODUCT || !isAdmin()) return;

  const currentRelated = Array.isArray(CURRENT_PRODUCT.relatedIds)
    ? CURRENT_PRODUCT.relatedIds.map(Number).filter(Number.isFinite)
    : [];

  if (currentRelated.includes(relatedId)) {
    if (relatedPickerHint) relatedPickerHint.textContent = "Цей товар уже додано.";
    return;
  }

  const nextRelated = [...currentRelated, relatedId];

  try {
    if (relatedPickerHint) relatedPickerHint.textContent = "Додаю...";

    await api(`/products/${CURRENT_PRODUCT.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relatedIds: nextRelated }),
    });

    await syncProductsFromApi();

    const fresh = getProds().find((x) => Number(x.id) === Number(CURRENT_PRODUCT.id));
    if (fresh) renderProduct(fresh);

    if (relatedPickerHint) relatedPickerHint.textContent = "Товар додано.";
    renderRelatedPickerResults(relatedPickerSearch?.value || "");
  } catch (err) {
    if (relatedPickerHint) relatedPickerHint.textContent = "Помилка: " + err.message;
  }
});

/* =========================
   ADMIN MODAL
========================= */
function fillProductCategorySelect(selectedId = null) {
  const cats = getCats().slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "uk", {
      sensitivity: "base",
    })
  );

  if (!pCategoryInput) return;

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
  if (adminProductTitle) adminProductTitle.textContent = "Редагувати товар";

  fillProductCategorySelect(product?.catId || null);
  ensureVariantEditorInModal();

  const variants = normalizeVariantsForClient(product);

  if (pTitleInput) pTitleInput.value = product?.title || "";
  if (pBrandInput) pBrandInput.value = product?.brand || "";
  if (pDescInput) pDescInput.value = product?.description || "";
  if (pImgInput) pImgInput.value = product?.img || "";
  if (pFileInput) pFileInput.value = "";
  if (pIdInput) pIdInput.value = product?.id ?? "";
  if (pRelatedInput) {
    pRelatedInput.value = Array.isArray(product?.relatedIds)
      ? product.relatedIds.join(",")
      : "";
  }

  if (pOrderTypeInput) {
    pOrderTypeInput.value =
      Number(product?.isCustomOrder || 0) === 1 ? "custom" : "stock";
  }

  fillAdminVariantRows(variants);

  if (pPriceInput) pPriceInput.readOnly = true;
  if (pUnitInput) pUnitInput.readOnly = true;
  if (pStockInput) pStockInput.readOnly = true;

  if (productFormHint) {
    productFormHint.textContent = "Редагуй фасування нижче. Ціна, одиниця виміру і склад рахуються автоматично.";
  }

  if (product?.img) {
    pPreview.src = product.img;
    pPreview.hidden = false;
  } else {
    pPreview.hidden = true;
    pPreview.removeAttribute("src");
  }

  if (deleteProductBtn) deleteProductBtn.hidden = false;
  adminProductModal?.setAttribute("aria-hidden", "false");
  if (adminProductOverlay) adminProductOverlay.hidden = false;
  if (adminProductModal) adminProductModal.hidden = false;
}

function closeProductAdminModal() {
  adminProductModal?.setAttribute("aria-hidden", "true");
  if (adminProductOverlay) adminProductOverlay.hidden = true;
  if (adminProductModal) adminProductModal.hidden = true;

  editingProductId = null;

  if (productFormHint) productFormHint.textContent = "";
  if (pPriceInput) pPriceInput.readOnly = false;
  if (pUnitInput) pUnitInput.readOnly = false;
  if (pStockInput) pStockInput.readOnly = false;
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
    pPreview.removeAttribute("src");
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
    if (productFormHint) productFormHint.textContent = "Завантажую фото...";
    const url = await uploadImage(file);
    if (pImgInput) pImgInput.value = url;
    if (pPreview) {
      pPreview.src = url;
      pPreview.hidden = false;
    }
    if (productFormHint) productFormHint.textContent = "Фото завантажено.";
  } catch (e) {
    if (productFormHint) productFormHint.textContent = "Помилка: " + e.message;
  }
});

saveProductBtn?.addEventListener("click", async () => {
  if (!editingProductId) return;

  try {
    const relatedIds = String(pRelatedInput?.value || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Number.isFinite);

    const variants = collectAdminVariants();

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
      isActive: 1,
      isCustomOrder: pOrderTypeInput?.value === "custom" ? 1 : 0,
      relatedIds,
      variants,
    };

    if (!payload.title) {
      if (productFormHint) productFormHint.textContent = "Введіть назву товару.";
      return;
    }

    if (productFormHint) productFormHint.textContent = "Зберігаю...";

    await api(`/products/${editingProductId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await syncProductsFromApi();
    await syncCategoriesFromApi();

    const updated = getProds().find((x) => Number(x.id) === Number(editingProductId));
    if (updated) {
      renderProduct(updated);
    }

    closeProductAdminModal();
  } catch (e) {
    if (productFormHint) productFormHint.textContent = "Помилка: " + e.message;
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
    if (productFormHint) productFormHint.textContent = "Помилка: " + e.message;
  }
});

/* =========================
   PRODUCT UI
========================= */
function fillUnits(product) {
  if (!pUnit) return;

  pUnit.innerHTML = "";

  const variants = normalizeVariantsForClient(product);

  if (variants.length) {
    variants.forEach((variant, index) => {
      const opt = document.createElement("option");
      opt.value = String(variant.id ?? index);
      opt.textContent = variant.label;
      opt.dataset.variantId = String(variant.id ?? index);
      pUnit.appendChild(opt);
    });
    return;
  }

  const opt = document.createElement("option");
  opt.value = product?.unit || "шт";
  opt.textContent = product?.unit || "шт";
  pUnit.appendChild(opt);
}

function getSelectedVariant(product) {
  const variants = normalizeVariantsForClient(product);
  if (!variants.length) return null;

  const selectedValue = String(pUnit?.value || "");
  return (
    variants.find((v, index) => String(v.id ?? index) === selectedValue) ||
    variants[0]
  );
}

function updateProductPriceAndStock(product) {
  if (!product) return;

  const isCustom = Number(product.isCustomOrder || 0) === 1;
  const variant = getSelectedVariant(product);

  const activePrice = variant
    ? Number(variant.price || 0)
    : Number(product.price || 0);

  const activeLabel = variant
    ? String(variant.label || "")
    : String(product.unit || "шт");

  const activeStock = variant
    ? Number(variant.stockQty ?? 0)
    : Number(product.stockQty ?? 0);

  if (productPrice) {
    productPrice.textContent = `${formatPrice(activePrice)} ₴ за ${activeLabel}`;
  }

  const cats = getCats();
  const cat = catById(cats, product.catId);

  const stockText = isCustom
    ? "Під замовлення"
    : activeStock > 0
      ? `В наявності: ${formatQty(activeStock)}`
      : "Немає в наявності";

  if (productMeta) {
    productMeta.textContent = `${cat ? cat.name : "Категорія"} • ${product.brand || "Без бренду"} • ${stockText}`;
  }

  if (addToCartBtn) {
    addToCartBtn.disabled = !isCustom && activeStock <= 0;
  }

  if (productHint) {
    productHint.textContent = isCustom
      ? "Цей товар доступний під замовлення. За деталями зверніться до консультанта."
      : activeStock > 0
        ? ""
        : "Цього товару зараз немає в наявності.";
  }

  if (pQty) {
    pQty.step = "1";
    pQty.min = "1";
    pQty.value = "1";

    if (!isCustom && activeStock > 0) {
      pQty.max = String(activeStock);
    } else {
      pQty.removeAttribute("max");
    }
  }
}

pUnit?.addEventListener("change", () => {
  if (!CURRENT_PRODUCT) return;
  updateProductPriceAndStock(CURRENT_PRODUCT);
});

function renderProduct(product) {
  const isCustom = Number(product.isCustomOrder || 0) === 1;

  CURRENT_PRODUCT = {
    ...product,
    variants: normalizeVariantsForClient(product),
  };

  if (productCustomBadge) productCustomBadge.hidden = !isCustom;
  if (productCustomHint) productCustomHint.hidden = !isCustom;
  if (productCustomNoteLabel) productCustomNoteLabel.hidden = !isCustom;

  if (productCustomNote) {
    productCustomNote.hidden = !isCustom;
    productCustomNote.placeholder =
      product.customNotePlaceholder || "Вкажіть уточнення до замовлення";
  }

  if (productEditBtn) productEditBtn.hidden = !isAdmin();
  if (productDeleteBtn) productDeleteBtn.hidden = !isAdmin();
  if (addRelatedProductBtn) addRelatedProductBtn.hidden = !isAdmin();

  if (productImg) {
    productImg.src = productImageSrc(product);
    productImg.alt = product.title || "Товар";
  }

  if (productTitle) productTitle.textContent = product.title || "Товар";
  if (productPageTitleTop) productPageTitleTop.textContent = "Товар";
  document.title = `${product.title || "Товар"} — БудМаркет`;

  fillUnits(CURRENT_PRODUCT);
  updateProductPriceAndStock(CURRENT_PRODUCT);

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

  renderRelated(CURRENT_PRODUCT);
}

function renderRelated(product) {
  if (!relatedGrid) return;

  const prods = getProds();
  let related = [];

  if (Array.isArray(product.relatedIds) && product.relatedIds.length) {
    related = prods.filter(
      (p) =>
        product.relatedIds.includes(Number(p.id)) &&
        Number(p.id) !== Number(product.id)
    );
  }

  if (!related.length) {
    related = prods
      .filter(
        (p) =>
          Number(p.catId) === Number(product.catId) &&
          Number(p.id) !== Number(product.id)
      )
      .slice(0, 4);
  }

  related = related.sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "uk", {
      sensitivity: "base",
    })
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
            ${escapeHTML(p.brand || "")}${p.brand ? " • " : ""}${escapeHTML(productCardUnitText(p))}
          </p>
          <div class="prodBottom">
            <div class="prodPrice">${productCardPriceText(p)} ₴</div>
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

      if (!CURRENT_PRODUCT) return;

      const ok = confirm(`Прибрати "${p.title}" з пов’язаних товарів?`);
      if (!ok) return;

      try {
        const currentProductId = Number(CURRENT_PRODUCT.id);

        const freshBeforeUpdate = getProds().find(
          (x) => Number(x.id) === currentProductId
        );
        const currentRelated = Array.isArray(freshBeforeUpdate?.relatedIds)
          ? freshBeforeUpdate.relatedIds.map(Number).filter(Number.isFinite)
          : [];

        const nextRelated = currentRelated.filter(
          (id) => Number(id) !== Number(p.id)
        );

        await api(`/products/${currentProductId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relatedIds: nextRelated }),
        });

        await syncProductsFromApi();

        const freshCurrent = getProds().find(
          (x) => Number(x.id) === currentProductId
        );
        if (freshCurrent) {
          CURRENT_PRODUCT = freshCurrent;
          renderRelated(freshCurrent);
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
function getSelectedVariantState() {
  const variant = getSelectedVariant(CURRENT_PRODUCT);

  return {
    variant,
    variantId: variant ? Number(variant.id ?? 0) : 0,
    variantLabel: variant
      ? String(variant.label || CURRENT_PRODUCT.unit || "шт")
      : String(CURRENT_PRODUCT.unit || "шт"),
    variantPrice: variant
      ? Number(variant.price || 0)
      : Number(CURRENT_PRODUCT.price || 0),
    variantStock: variant
      ? Number(variant.stockQty ?? 0)
      : Number(CURRENT_PRODUCT.stockQty ?? 0),
  };
}

pMinus?.addEventListener("click", () => {
  if (!CURRENT_PRODUCT || !pQty) return;

  let v = Number(pQty.value || 1);
  v = clamp(v - 1, 1, Number.MAX_SAFE_INTEGER);
  pQty.value = String(v);
});

pPlus?.addEventListener("click", () => {
  if (!CURRENT_PRODUCT || !pQty) return;

  const isCustom = Number(CURRENT_PRODUCT.isCustomOrder || 0) === 1;
  const { variantStock } = getSelectedVariantState();

  let max = Number.MAX_SAFE_INTEGER;
  if (!isCustom && variantStock > 0) {
    max = variantStock;
  }

  let v = Number(pQty.value || 1);
  v = clamp(v + 1, 1, max);
  pQty.value = String(v);
});

addToCartBtn?.addEventListener("click", () => {
  if (!CURRENT_PRODUCT) return;

  const qty = Number(pQty?.value || 1);
  const isCustom = Number(CURRENT_PRODUCT.isCustomOrder || 0) === 1;
  const customNote = String(productCustomNote?.value || "").trim();

  if (!Number.isFinite(qty) || qty <= 0) {
    if (productHint) productHint.textContent = "Вкажіть коректну кількість.";
    return;
  }

  const { variantId, variantLabel, variantPrice, variantStock } =
    getSelectedVariantState();

  if (!isCustom && variantStock > 0 && qty > variantStock) {
    if (productHint) {
      productHint.textContent = `В наявності тільки ${formatQty(variantStock)} ${variantLabel}.`;
    }
    return;
  }

  const cart = getCart();

  const key = [
    CURRENT_PRODUCT.id,
    variantId,
    encodeURIComponent(customNote || ""),
  ].join("|");

  const currentItem =
    cart[key] && typeof cart[key] === "object" ? cart[key] : { qty: 0 };

  const currentQty = Number(currentItem.qty || 0);
  const nextQty = currentQty + qty;

  if (!isCustom && variantStock > 0 && nextQty > variantStock) {
    if (productHint) {
      productHint.textContent = `У кошик можна додати максимум ${formatQty(variantStock)} ${variantLabel}.`;
    }
    return;
  }

  cart[key] = {
    qty: nextQty,
    unit: variantLabel,
    price: variantPrice,
    variantId,
    variantLabel,
    title: CURRENT_PRODUCT.title || "",
    img: CURRENT_PRODUCT.img || "",
    brand: CURRENT_PRODUCT.brand || "",
    catId: CURRENT_PRODUCT.catId ?? null,
    isCustomOrder: Number(CURRENT_PRODUCT.isCustomOrder || 0),
    stockQty: variantStock,
  };

  setCart(cart);
  updateCartBadge();

  if (productHint) {
    productHint.textContent = isCustom
      ? "Товар під замовлення додано в кошик."
      : "Товар додано в кошик.";
  }
});

/* =========================
   INIT
========================= */
(async function initProductPage() {
  try {
    updateCartBadge();
    ensureVariantEditorInModal();
    await syncCategoriesFromApi();
    await syncProductsFromApi();

    const productId = getProductIdFromUrl();
    const prods = getProds();

    if (!Number.isFinite(productId) || productId <= 0) {
      if (productTitle) productTitle.textContent = "Товар не знайдено";
      if (productMeta) productMeta.textContent = "Некоректне посилання на товар.";
      if (productPrice) productPrice.textContent = "0.00 ₴";
      if (productDescription) {
        productDescription.textContent = "У URL немає правильного id товару.";
      }
      if (relatedGrid) relatedGrid.innerHTML = "";
      return;
    }

    const product = prods.find((p) => Number(p.id) === Number(productId));

    if (!product) {
      if (productTitle) productTitle.textContent = "Товар не знайдено";
      if (productMeta) productMeta.textContent = "Такий товар відсутній у базі.";
      if (productPrice) productPrice.textContent = "0.00 ₴";
      if (productDescription) {
        productDescription.textContent =
          "Можливо, товар був видалений або ще не завантажився.";
      }
      if (relatedGrid) relatedGrid.innerHTML = "";
      return;
    }

    renderProduct(product);
  } catch (e) {
    console.error(e);
    if (productHint) productHint.textContent = "Помилка завантаження сторінки товару.";
  }
})();