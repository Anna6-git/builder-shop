"use strict";

const API_BASE = window.API_BASE || "http://localhost:3001";

const KEY_PRODS = "products_db";
const KEY_CATS = "categories_db";
const KEY_CART = "cart_v2";

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

function cartUniqueProductsCount() {
  const cart = getCart();
  const ids = new Set(Object.keys(cart).map((k) => String(k).split("|")[0]));
  return ids.size;
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



function productImageSrc(p) {
  return p?.img
    ? p.img
    : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='420' viewBox='0 0 600 420'><rect width='600' height='420' fill='%23eef2f7'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='28'>Немає фото</text></svg>";
}

function categoryImageSrc(c) {
  return c?.img
    ? c.img
    : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='320' viewBox='0 0 800 320'><rect width='800' height='320' fill='%23eef2f7'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='32'>Немає фото категорії</text></svg>";
}

function getCategoryIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("cat"));
}

async function syncFromApi() {
  try {
    const [catsRes, prodsRes] = await Promise.all([
      fetch(`${API_BASE}/api/categories`),
      fetch(`${API_BASE}/api/products`)
    ]);

    if (catsRes.ok) {
      const cats = await catsRes.json();
      if (Array.isArray(cats)) setCats(cats);
    }

    if (prodsRes.ok) {
      const prods = await prodsRes.json();
      if (Array.isArray(prods)) setProds(prods);
    }
  } catch (e) {
    console.warn("syncFromApi failed:", e);
  }
}

const categoryBackBtn = document.getElementById("categoryBackBtn");
const cartCount = document.getElementById("cartCount");
const categoryTitle = document.getElementById("categoryTitle");
const categoryCount = document.getElementById("categoryCount");
const categoryImage = document.getElementById("categoryImage");
const categoryProductsGrid = document.getElementById("categoryProductsGrid");

function updateCartBadge() {
  if (cartCount) cartCount.textContent = String(cartUniqueProductsCount());
}

function goBackSmart() {
  if (document.referrer && document.referrer !== window.location.href) {
    history.back();
    return;
  }
  window.location.href = "index.html";
}

function renderCategoryPage() {
  const catId = getCategoryIdFromUrl();
  const cats = getCats();
  const prods = getProds();

  const cat = cats.find((x) => Number(x.id) === Number(catId));

  if (!cat) {
    if (categoryTitle) categoryTitle.textContent = "Категорію не знайдено";
    if (categoryCount) categoryCount.textContent = "Немає даних";
    if (categoryProductsGrid) categoryProductsGrid.innerHTML = `<div class="hint">Категорія не знайдена.</div>`;
    return;
  }

const list = prods
  .filter((p) => Number(p.catId) === Number(cat.id))
  .sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "uk", { sensitivity: "base" })
  );

  document.title = `${cat.name} — БудМаркет`;
  if (categoryTitle) categoryTitle.textContent = cat.name;
  if (categoryCount) categoryCount.textContent = `${list.length} товар(ів)`;
  if (categoryImage) {
    categoryImage.src = categoryImageSrc(cat);
    categoryImage.alt = cat.name;
  }

  if (!categoryProductsGrid) return;
  categoryProductsGrid.innerHTML = "";

  if (!list.length) {
    categoryProductsGrid.innerHTML = `<div class="hint">У цій категорії поки немає товарів.</div>`;
    return;
  }

  list.forEach((p) => {
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
    </div>
  </div>

  ${
    isAdmin()
      ? `
        <div class="prodCard__adminActions">
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
    const editBtn = card.querySelector('[data-act="edit-product"]');
const delBtn = card.querySelector('[data-act="del-product"]');

editBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  openProductAdminModal(p);
});

delBtn?.addEventListener("click", async (e) => {
  e.stopPropagation();

  const ok = confirm("Видалити товар?");
  if (!ok) return;

  try {
    await api(`/products/${p.id}`, { method: "DELETE" });
    await syncFromApi();
    renderCategoryPage();
  } catch (err) {
    alert("Помилка: " + err.message);
  }
});

    categoryProductsGrid.appendChild(card);
  });
}

categoryBackBtn?.addEventListener("click", goBackSmart);

(async function initCategoryPage() {
  updateCartBadge();
  await syncFromApi();
  renderCategoryPage();
})();

let editingProductId = null;

const adminProductOverlay = document.getElementById("adminProductOverlay");
const adminProductModal = document.getElementById("adminProductModal");
const adminProductClose = document.getElementById("adminProductClose");
const adminProductTitle = document.getElementById("adminProductTitle");
const adminAddProductBtn = document.getElementById("adminAddProductBtn");

adminAddProductBtn?.addEventListener("click", () => {
  console.log("Кнопка Додати товар натиснута");
  openProductAdminModal();
});

const pTitleInput = document.getElementById("pTitleInput");
const pCategoryInput = document.getElementById("pCategoryInput");
const pPriceInput = document.getElementById("pPriceInput");
const pBrandInput = document.getElementById("pBrandInput");
const pUnitInput = document.getElementById("pUnitInput");
const pIdInput = document.getElementById("pIdInput");
const pStockInput = document.getElementById("pStockInput");
const pOrderTypeInput = document.getElementById("pOrderTypeInput");
const pCustomNoteInput = document.getElementById("pCustomNoteInput");
const pDescInput = document.getElementById("pDescInput");
const pRelatedInput = document.getElementById("pRelatedInput");
const pRelatedSearchInput = document.getElementById("pRelatedSearchInput");
const pImgInput = document.getElementById("pImgInput");
const pFileInput = document.getElementById("pFileInput");
const pPreview = document.getElementById("pPreview");
const saveProductBtn = document.getElementById("saveProductBtn");
const deleteProductBtn = document.getElementById("deleteProductBtn");
const productFormHint = document.getElementById("productFormHint");


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

function openProductAdminModal(product = null) {
  if (!isAdmin()) return;

  editingProductId = product?.id || null;
  adminProductTitle.textContent = product ? "Редагувати товар" : "Додати товар";

  fillProductCategorySelect(product?.catId || null);
currentRelatedBaseProductId = product?.id || null;
currentRelatedSelectedIds = Array.isArray(product?.relatedIds) ? [...product.relatedIds] : [];

if (pRelatedSearchInput) {
  pRelatedSearchInput.value = "";
}

fillRelatedProductsSelect(currentRelatedBaseProductId, currentRelatedSelectedIds, "");

  pTitleInput.value = product?.title || "";
  pPriceInput.value = product ? Number(product.price).toFixed(2) : "";
  pBrandInput.value = product?.brand || "";
  pUnitInput.value = product?.unit || "";
  if (pOrderTypeInput) {
  pOrderTypeInput.value = Number(product?.isCustomOrder || 0) === 1 ? "custom" : "stock";
}

pRelatedSearchInput?.addEventListener("input", () => {
  const selectedNow = Array.from(pRelatedInput?.selectedOptions || [])
    .map((opt) => Number(opt.value))
    .filter(Number.isFinite);

  currentRelatedSelectedIds = Array.from(new Set([
    ...currentRelatedSelectedIds,
    ...selectedNow
  ]));

  fillRelatedProductsSelect(
    currentRelatedBaseProductId,
    currentRelatedSelectedIds,
    pRelatedSearchInput.value
  );
});

pRelatedInput?.addEventListener("change", () => {
  currentRelatedSelectedIds = Array.from(pRelatedInput.selectedOptions || [])
    .map((opt) => Number(opt.value))
    .filter(Number.isFinite);
});

if (pCustomNoteInput) {
  pCustomNoteInput.value = product?.customNotePlaceholder || "";
}
pIdInput.value = product?.id ? String(product.id) : "Створиться автоматично";
  pStockInput.value = product ? String(product.stockQty ?? 0) : "0";
  pDescInput.value = product?.description || "";
  pRelatedInput.value = Array.isArray(product?.relatedIds) ? product.relatedIds.join(",") : "";
  pImgInput.value = product?.img || "";
  pFileInput.value = "";
  productFormHint.textContent = "";

  if (product?.img) {
    pPreview.src = product.img;
    pPreview.hidden = false;
  } else {
    pPreview.hidden = true;
    pPreview.removeAttribute("src");
  }

  adminProductOverlay.hidden = false;
  adminProductModal.hidden = false;
  adminProductModal.setAttribute("aria-hidden", "false");
}

function closeProductAdminModal() {
  adminProductOverlay.hidden = true;
  adminProductModal.hidden = true;
  editingProductId = null;
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
    const payload = {
      title: String(pTitleInput.value || "").trim(),
      catId: Number(pCategoryInput.value),
      price: Number(String(pPriceInput.value || "").replace(",", ".")),
      brand: String(pBrandInput.value || "").trim(),
      unit: String(pUnitInput.value || "").trim() || "шт",
      unitType: "pcs",
      stockQty: Number(pStockInput.value || 0),
      description: String(pDescInput.value || "").trim(),
relatedIds: currentRelatedSelectedIds,
      img: String(pImgInput.value || "").trim(),
      isCustomOrder: pOrderTypeInput?.value === "custom" ? 1 : 0,
      customNotePlaceholder: String(pCustomNoteInput?.value || "").trim(),
      isActive: 1
    };

    if (!payload.title) {
      productFormHint.textContent = "Введіть назву товару.";
      return;
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      productFormHint.textContent = "Невірна ціна.";
      return;
    }

    if (!Number.isFinite(payload.stockQty) || payload.stockQty < 0) {
      productFormHint.textContent = "Невірна кількість на складі.";
      return;
    }

    productFormHint.textContent = "Зберігаю...";

    if (editingProductId) {
      await api(`/products/${editingProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await api(`/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    await syncFromApi();
    renderCategoryPage();
    closeProductAdminModal();
  } catch (e) {
    productFormHint.textContent = "Помилка: " + e.message;
  }
});

function refreshAdminUI() {
  const token = localStorage.getItem("admin_token") || "";
  const session = JSON.parse(localStorage.getItem("current_user") || "null");
  const isAdmin = Boolean(token) && session?.role === "admin";

  document.querySelectorAll(".adminOnly").forEach((el) => {
    el.hidden = !isAdmin;
  });
}

let currentRelatedBaseProductId = null;
let currentRelatedSelectedIds = [];

function fillRelatedProductsSelect(currentProductId = null, selectedIds = [], search = "") {
  if (!pRelatedInput) return;

  const query = String(search || "").trim().toLowerCase();

  const prods = getProds()
    .filter((p) => Number(p.id) !== Number(currentProductId))
    .filter((p) => {
      if (!query) return true;

      const title = String(p.title || "").toLowerCase();
      const idText = String(p.id || "");
      return title.includes(query) || idText.includes(query);
    })
    .sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "uk", { sensitivity: "base" })
    );

  pRelatedInput.innerHTML = "";

  prods.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = String(p.id);
    opt.textContent = `${p.title} (ID: ${p.id})`;
    if (selectedIds.includes(Number(p.id))) opt.selected = true;
    pRelatedInput.appendChild(opt);
  });
}

deleteProductBtn?.addEventListener("click", async () => {
  if (!editingProductId) return;

  const ok = confirm("Видалити товар?");
  if (!ok) return;

  try {
    await api(`/products/${editingProductId}`, { method: "DELETE" });
    await syncFromApi();
    renderCategoryPage();
    closeProductAdminModal();
  } catch (e) {
    productFormHint.textContent = "Помилка: " + e.message;
  }
});
refreshAdminUI();