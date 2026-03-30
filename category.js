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

function cartUniqueProductsCount() {
  const cart = getCart();
  const ids = new Set(Object.keys(cart).map((k) => String(k).split("|")[0]));
  return ids.size;
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

function parseLooseNumber(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
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

/* =========================
   DOM
========================= */
const categoryBackBtn = document.getElementById("categoryBackBtn");
const cartCount = document.getElementById("cartCount");
const categoryTitle = document.getElementById("categoryTitle");
const categoryCount = document.getElementById("categoryCount");
const categoryImage = document.getElementById("categoryImage");
const categoryProductsGrid = document.getElementById("categoryProductsGrid");

const adminProductOverlay = document.getElementById("adminProductOverlay");
const adminProductModal = document.getElementById("adminProductModal");
const adminProductClose = document.getElementById("adminProductClose");
const adminProductTitle = document.getElementById("adminProductTitle");
const adminAddProductBtn = document.getElementById("adminAddProductBtn");

const pTitleInput = document.getElementById("pTitleInput");
const pCategoryInput = document.getElementById("pCategoryInput");
const pBrandInput = document.getElementById("pBrandInput");
const pOrderTypeInput = document.getElementById("pOrderTypeInput");
const pDescInput = document.getElementById("pDescInput");
const pImgInput = document.getElementById("pImgInput");
const pFileInput = document.getElementById("pFileInput");
const pPreview = document.getElementById("pPreview");
const saveProductBtn = document.getElementById("saveProductBtn");
const deleteProductBtn = document.getElementById("deleteProductBtn");
const productFormHint = document.getElementById("productFormHint");
const variantRows = document.getElementById("variantRows");
const addVariantRowBtn = document.getElementById("addVariantRowBtn");

let editingProductId = null;

/* =========================
   VARIANTS UI
========================= */
function createVariantRow(label = "", price = "", stockQty = "") {
  const row = document.createElement("div");
  row.className = "variantRow";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1.3fr 1fr 1fr auto";
  row.style.gap = "8px";

  row.innerHTML = `
    <input class="authInput" data-field="label" placeholder="Фасування, напр. 0.9кг" value="${escapeHTML(label)}">
    <input class="authInput" data-field="price" type="number" step="0.01" min="0" placeholder="Ціна" value="${escapeHTML(price)}">
    <input class="authInput" data-field="stockQty" type="number" step="0.1" min="0" placeholder="Кількість" value="${escapeHTML(stockQty)}">
    <button class="btnDanger" type="button" data-act="removeVariant">×</button>
  `;

  row.addEventListener("click", (e) => {
    if (e.target?.dataset?.act !== "removeVariant") return;

    row.remove();

    if (!variantRows.children.length) {
      variantRows.appendChild(createVariantRow());
    }
  });

  return row;
}

function resetVariantRows() {
  if (!variantRows) return;
  variantRows.innerHTML = "";
  variantRows.appendChild(createVariantRow());
}

function fillVariantRows(variants) {
  if (!variantRows) return;

  variantRows.innerHTML = "";

  if (Array.isArray(variants) && variants.length) {
    variants.forEach((v) => {
      variantRows.appendChild(
        createVariantRow(
          v?.label || "",
          Number.isFinite(Number(v?.price)) ? String(v.price) : "",
          Number.isFinite(Number(v?.stockQty)) ? String(v.stockQty) : ""
        )
      );
    });
  } else {
    variantRows.appendChild(createVariantRow());
  }
}

function collectVariantsFromForm() {
  const rows = Array.from(variantRows.querySelectorAll(".variantRow"));

  return rows
    .map((row, index) => {
      const labelRaw = row.querySelector('[data-field="label"]')?.value ?? "";
      const priceRaw = row.querySelector('[data-field="price"]')?.value ?? "";
      const stockRaw = row.querySelector('[data-field="stockQty"]')?.value ?? "";

      const label = String(labelRaw).trim();
      const price = parseLooseNumber(priceRaw);
      const stockQty = parseLooseNumber(stockRaw);

      const isEmpty = !label && !String(priceRaw).trim() && !String(stockRaw).trim();
      if (isEmpty) return null;

      return {
        label,
        price,
        stockQty,
        sortOrder: index,
      };
    })
    .filter(Boolean);
}

/* =========================
   BASIC UI
========================= */
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

function fillProductCategorySelect(selectedId = null) {
  const cats = getCats().slice().sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "uk", { sensitivity: "base" })
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

function openProductAdminModal(product = null) {
  if (!isAdmin()) return;

  editingProductId = product?.id || null;
  if (adminProductTitle) {
    adminProductTitle.textContent = product ? "Редагувати товар" : "Додати товар";
  }

  fillProductCategorySelect(product?.catId || getCategoryIdFromUrl() || null);

  const variants = normalizeVariantsForClient(product);

  if (pTitleInput) pTitleInput.value = product?.title || "";
  if (pBrandInput) pBrandInput.value = product?.brand || "";
  if (pOrderTypeInput) {
    pOrderTypeInput.value = Number(product?.isCustomOrder || 0) === 1 ? "custom" : "stock";
  }
  if (pDescInput) pDescInput.value = product?.description || "";
  if (pImgInput) pImgInput.value = product?.img || "";
  if (pFileInput) pFileInput.value = "";
  if (productFormHint) productFormHint.textContent = "";

  fillVariantRows(variants);

  if (pPreview) {
    if (product?.img) {
      pPreview.src = product.img;
      pPreview.hidden = false;
    } else {
      pPreview.hidden = true;
      pPreview.removeAttribute("src");
    }
  }

  if (deleteProductBtn) deleteProductBtn.hidden = !product;

  if (adminProductOverlay) adminProductOverlay.hidden = false;
  if (adminProductModal) {
    adminProductModal.hidden = false;
    adminProductModal.setAttribute("aria-hidden", "false");
  }
}

function closeProductAdminModal() {
  if (adminProductOverlay) adminProductOverlay.hidden = true;
  if (adminProductModal) {
    adminProductModal.hidden = true;
    adminProductModal.setAttribute("aria-hidden", "true");
  }

  editingProductId = null;
}

/* =========================
   RENDER
========================= */
function renderCategoryPage() {
  const catId = getCategoryIdFromUrl();
  const cats = getCats();
  const prods = getProds();

  const cat = cats.find((x) => Number(x.id) === Number(catId));

  if (!cat) {
    if (categoryTitle) categoryTitle.textContent = "Категорію не знайдено";
    if (categoryCount) categoryCount.textContent = "Немає даних";
    if (categoryProductsGrid) {
      categoryProductsGrid.innerHTML = `<div class="hint">Категорія не знайдена.</div>`;
    }
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
    const variants = normalizeVariantsForClient(p);

    const variantsText = variants.length
      ? variants
          .map(
            (v) =>
              `${v.label}: ${formatPrice(v.price)} ₴ • склад: ${Number(v.stockQty ?? 0)}`
          )
          .join("<br>")
      : "Фасування не задані";

    const card = document.createElement("article");
    card.className = "prodCard";

    card.innerHTML = `
      <div class="prodCard__main">
        <img class="prodImg" src="${escapeHTML(productImageSrc(p))}" alt="${escapeHTML(p.title)}">
        <div class="prodBody">
          <h3 class="prodTitle">${escapeHTML(p.title)}</h3>
          <p class="prodMeta">
            ${escapeHTML(p.brand || "")}
          </p>
          <div class="prodBottom">
            <div class="prodPrice">${productCardPriceText(p)} ₴</div>
          </div>
          <div class="prodMeta" style="margin-top:8px;">
            ${variantsText}
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

/* =========================
   UPLOAD
========================= */
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

/* =========================
   EVENTS
========================= */
categoryBackBtn?.addEventListener("click", goBackSmart);

adminAddProductBtn?.addEventListener("click", () => {
  openProductAdminModal();
});

adminProductClose?.addEventListener("click", closeProductAdminModal);
adminProductOverlay?.addEventListener("click", closeProductAdminModal);

addVariantRowBtn?.addEventListener("click", () => {
  variantRows?.appendChild(createVariantRow());
});

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
  try {
    const title = String(pTitleInput?.value || "").trim();
    const catId = Number(pCategoryInput?.value);
    const brand = String(pBrandInput?.value || "").trim();
    const description = String(pDescInput?.value || "").trim();
    const img = String(pImgInput?.value || "").trim();
    const isCustomOrder = pOrderTypeInput?.value === "custom" ? 1 : 0;
    const variants = collectVariantsFromForm();

    if (!title) {
      if (productFormHint) productFormHint.textContent = "Введіть назву товару.";
      return;
    }

    if (!Number.isFinite(catId)) {
      if (productFormHint) productFormHint.textContent = "Оберіть категорію.";
      return;
    }

    if (!brand) {
      if (productFormHint) productFormHint.textContent = "Введіть виробника.";
      return;
    }

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
      title,
      catId,
      brand,
      img,
      description,
      isCustomOrder,
      isActive: 1,
      variants,
    };

    if (productFormHint) productFormHint.textContent = "Зберігаю...";

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
    if (productFormHint) productFormHint.textContent = "Помилка: " + e.message;
  }
});

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
    if (productFormHint) productFormHint.textContent = "Помилка: " + e.message;
  }
});

function refreshAdminUI() {
  const token = localStorage.getItem("admin_token") || "";
  const session = JSON.parse(localStorage.getItem("current_user") || "null");
  const isAdminNow = Boolean(token) && session?.role === "admin";

  document.querySelectorAll(".adminOnly").forEach((el) => {
    el.hidden = !isAdminNow;
  });
}

/* =========================
   INIT
========================= */
(async function initCategoryPage() {
  updateCartBadge();
  refreshAdminUI();
  resetVariantRows();
  await syncFromApi();
  renderCategoryPage();
})();