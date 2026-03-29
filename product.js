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

function firstVariant(product) {
  return Array.isArray(product?.variants) && product.variants.length
    ? product.variants[0]
    : null;
}

function productCardPriceText(product) {
  const v = firstVariant(product);
  return formatPrice(v ? v.price : product?.price || 0);
}

function productCardUnitText(product) {
  const v = firstVariant(product);
  return v?.label || product?.unit || "шт";
}

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

addRelatedProductBtn?.addEventListener("click", () => {
  openRelatedPicker();
});

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
          ID: ${p.id}${p.brand ? ` • ${escapeHTML(p.brand)}` : ""}${Number.isFinite(Number(p.price)) ? ` • ${formatPrice(p.price)} ₴` : ""}
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

  await addRelatedProductById(relatedId);
});

async function addRelatedProductById(relatedId) {
  if (!CURRENT_PRODUCT || !isAdmin()) return;

  const currentRelated = Array.isArray(CURRENT_PRODUCT.relatedIds)
    ? CURRENT_PRODUCT.relatedIds.map(Number).filter(Number.isFinite)
    : [];

  if (currentRelated.includes(Number(relatedId))) {
    if (relatedPickerHint) relatedPickerHint.textContent = "Цей товар уже додано.";
    return;
  }

  const nextRelated = [...currentRelated, Number(relatedId)];

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
}

/* =========================
   ADMIN MODAL
========================= */
function fillProductCategorySelect(selectedId = null) {
  const cats = getCats().slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "uk", {
      sensitivity: "base",
    })
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

  const fv = firstVariant(product);

  pTitleInput.value = product?.title || "";
  pPriceInput.value = fv ? Number(fv.price).toFixed(2) : Number(product?.price || 0).toFixed(2);
  pBrandInput.value = product?.brand || "";
  pUnitInput.value = fv?.label || product?.unit || "";
  pStockInput.value = fv ? String(fv.stockQty ?? 0) : String(product?.stockQty ?? 0);
  pDescInput.value = product?.description || "";
  pImgInput.value = product?.img || "";
  pFileInput.value = "";
  productFormHint.textContent = "Фасування редагуються в адмін-панелі товарів.";

  pPriceInput.disabled = true;
  pUnitInput.disabled = true;
  pStockInput.disabled = true;

  if (pIdInput) {
    pIdInput.value = product?.id ?? "";
  }

  if (pOrderTypeInput) {
    pOrderTypeInput.value =
      Number(product?.isCustomOrder || 0) === 1 ? "custom" : "stock";
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

  if (deleteProductBtn) {
    deleteProductBtn.hidden = false;
  }

  adminProductModal.setAttribute("aria-hidden", "false");
  adminProductOverlay.hidden = false;
  adminProductModal.hidden = false;
}

function closeProductAdminModal() {
  adminProductModal.setAttribute("aria-hidden", "true");
  adminProductOverlay.hidden = true;
  adminProductModal.hidden = true;
  editingProductId = null;
  productFormHint.textContent = "";

  pPriceInput.disabled = false;
  pUnitInput.disabled = false;
  pStockInput.disabled = false;

  if (deleteProductBtn) {
    deleteProductBtn.hidden = false;
  }
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
  try {
    const relatedIds = String(pRelatedInput?.value || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Number.isFinite);

    const payload = {
      title: String(pTitleInput.value || "").trim(),
      catId: Number(pCategoryInput.value),
      brand: String(pBrandInput.value || "").trim(),
      description: String(pDescInput.value || "").trim(),
      img: String(pImgInput.value || "").trim(),
      isActive: 1,
      isCustomOrder: pOrderTypeInput?.value === "custom" ? 1 : 0,
      relatedIds,
    };

    if (!payload.title) {
      productFormHint.textContent = "Введіть назву товару.";
      return;
    }

    productFormHint.textContent = editingProductId ? "Зберігаю..." : "Створюю...";

    if (editingProductId) {
      await api(`/products/${editingProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    await syncProductsFromApi();

    if (editingProductId) {
      const updated = getProds().find((x) => Number(x.id) === Number(editingProductId));
      if (updated) {
        renderProduct(updated);
      }
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
   PRODUCT UI
========================= */
function fillUnits(product) {
  if (!pUnit) return;
  pUnit.innerHTML = "";

  const variants = Array.isArray(product?.variants) ? product.variants : [];

  if (variants.length) {
    variants.forEach((variant, index) => {
      const opt = document.createElement("option");
      opt.value = String(variant.id ?? index);
      opt.textContent = `${variant.label} — ${formatPrice(variant.price)} ₴`;
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
  const variants = Array.isArray(product?.variants) ? product.variants : [];
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

  if (!pQty) return;

  pQty.step = "1";
  pQty.min = "1";
  pQty.value = "1";

  if (!isCustom && activeStock > 0) {
    pQty.max = String(activeStock);
  } else {
    pQty.removeAttribute("max");
  }
}

pUnit?.addEventListener("change", () => {
  if (!CURRENT_PRODUCT) return;
  updateProductPriceAndStock(CURRENT_PRODUCT);
});

function renderProduct(product) {
  const isCustom = Number(product.isCustomOrder || 0) === 1;

  if (productCustomBadge) productCustomBadge.hidden = !isCustom;
  if (productCustomHint) productCustomHint.hidden = !isCustom;
  if (productCustomNoteLabel) productCustomNoteLabel.hidden = !isCustom;

  if (productCustomNote) {
    productCustomNote.hidden = !isCustom;
    productCustomNote.placeholder =
      product.customNotePlaceholder || "Вкажіть уточнення до замовлення";
  }

  CURRENT_PRODUCT = product;

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

  fillUnits(product);
  updateProductPriceAndStock(product);

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

  renderRelated(product);
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

  const min = 1;
  let v = Number(pQty.value || 1);
  v = clamp(v - 1, min, Number.MAX_SAFE_INTEGER);
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
    if (productHint) {
      productHint.textContent = "Вкажіть коректну кількість.";
    }
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
})();