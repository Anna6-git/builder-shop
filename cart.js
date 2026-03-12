console.log("✅ cart.js loaded");

const KEY_PRODS = "products_db";
const KEY_CATS = "categories_db";
const KEY_CART = "cart_v2";
const API_BASE = window.API_BASE || "http://localhost:3001";
const ORDER_KEY = "some_long_random_string";

const TG_LINK = "https://t.me/MarinaStyaglyuk";
const CALL_PHONE = "+380988966988";

/* helpers */
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

function getCats() {
  return safeParse(localStorage.getItem(KEY_CATS), []);
}

function getCart() {
  return safeParse(localStorage.getItem(KEY_CART), {});
}

function setCart(cartObj) {
  localStorage.setItem(KEY_CART, JSON.stringify(cartObj || {}));
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCartKey(key) {
  const parts = String(key).split("|");
  const id = Number(parts[0]);
  const unit = parts[1] || "шт";
  const customNote = parts.slice(2).join("|") || "";
  return { id, unit, customNote };
}

function formatQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

function formatPrice(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}

function stepByUnitType(unitType) {
  return unitType === "length" || unitType === "weight" ? 0.1 : 1;
}

function isInStock(p) {
  return Number(p?.stockQty || 0) > 0;
}

function productImageSrc(p) {
  return p?.img ? p.img : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='220' viewBox='0 0 300 220'><rect width='300' height='220' fill='%23eef2f7'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='18'>Немає фото</text></svg>";
}

/* DOM */
const cartList = document.getElementById("cartList");
const cartItemsCount = document.getElementById("cartItemsCount");
const cartTotal = document.getElementById("cartTotal");
const clearCartBtn = document.getElementById("clearCartBtn");

const tgBtn = document.getElementById("tgBtn");
const callBtn = document.getElementById("callBtn");

const overlay = document.getElementById("checkoutOverlay");
const modal = document.getElementById("checkoutModal");
const closeBtn = document.getElementById("checkoutClose");
const checkoutSendBtn = document.getElementById("checkoutSendBtn");

const cCity = document.getElementById("cCity");
const cAddress = document.getElementById("cAddress");
const cPhone = document.getElementById("cPhone");
const cEmail = document.getElementById("cEmail");
const cName = document.getElementById("cName");
const cDate = document.getElementById("cDate");
const checkoutHint = document.getElementById("checkoutHint");

const checkoutPreview = document.getElementById("checkoutPreview");
const checkoutTotal = document.getElementById("checkoutTotal");

const afterConfirm = document.getElementById("afterConfirm");
const sendTg = document.getElementById("sendTg");
const sendCall = document.getElementById("sendCall");
const cartHint = document.getElementById("cartHint");

/* render */
function renderCart() {
  const prods = getProds();
  const cats = getCats();
  const cart = getCart();

  if (!cartList) return;

  const entries = Object.entries(cart).filter(([, qty]) => Number(qty) > 0);

  if (entries.length === 0) {
    cartList.innerHTML = `<div class="hint">Кошик порожній.</div>`;

    if (cartItemsCount) cartItemsCount.textContent = "0";
    if (cartTotal) cartTotal.textContent = "0.00";

    if (checkoutPreview) {
      checkoutPreview.innerHTML = `<div class="hint">Немає товарів.</div>`;
    }

    if (checkoutTotal) {
      checkoutTotal.textContent = `0.00 ₴`;
    }

    return;
  }

  let totalQty = 0;
  let totalSum = 0;

  cartList.innerHTML = "";
  if (checkoutPreview) checkoutPreview.innerHTML = "";

  for (const [key, qtyRaw] of entries) {
let qty = Number(qtyRaw);
const { id, unit, customNote } = parseCartKey(key);

const p = prods.find((x) => Number(x.id) === Number(id));
if (!p) continue;

const stock = Number(p.stockQty ?? p.stock_qty ?? 0);
const limitByStock = Number(p.isCustomOrder || 0) !== 1 && p.unitType === "pcs";

if (limitByStock && Number.isFinite(stock) && stock >= 0 && qty > stock) {
  qty = stock;

  const cart = getCart();
  if (qty > 0) {
    cart[key] = qty;
  } else {
    delete cart[key];
  }
  setCart(cart);

  if (cartHint) {
    const productTitle = p.title || p.name || "товару";
    cartHint.textContent = `Для товару "${productTitle}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
  }
}

    const cat = cats.find((c) => Number(c.id) === Number(p.catId));
    const rowSum = Number(p.price) * qty;

    totalQty += qty;
    totalSum += rowSum;

    const step = stepByUnitType(p.unitType);

const stockQtyNum = Number(p.stockQty || 0);

const stockText =
  Number(p.isCustomOrder || 0) === 1
    ? "Під замовлення"
    : typeof p.stockQty !== "undefined"
      ? isInStock(p)
        ? `В наявності: ${stockQtyNum}`
        : "Немає в наявності"
      : "";

const limitedByStock =
  Number(p.isCustomOrder || 0) !== 1 &&
  p.unitType === "pcs" &&
  Number.isFinite(stockQtyNum) &&
  stockQtyNum >= 0;

const overStock =
  limitedByStock && qty > stockQtyNum;

const maxReached =
  limitedByStock && qty >= stockQtyNum && stockQtyNum > 0;

    const row = document.createElement("div");
    row.className = "cartRow";
    row.innerHTML = `
<img class="cartImg" src="${escapeHTML(productImageSrc(p))}" alt="${escapeHTML(p.title)}">
      <div class="cartInfo">
        <div class="cartTitle">${escapeHTML(p.title)}</div>
        <div class="cartMeta">
          ${escapeHTML(cat ? cat.name : "Категорія")} • ${escapeHTML(p.brand || "")} • ${escapeHTML(unit)} • ${escapeHTML(stockText)}
         ${
  overStock
    ? `<div class="hint" style="color:#b91c1c;margin-top:4px;">
         В наявності ${stockQtyNum} шт. Можна додати тільки ${stockQtyNum} шт.
       </div>`
    : ""
}
${
  maxReached && !overStock
    ? `<div class="hint" style="color:#92400e;margin-top:4px;">
         Досягнуто максимум: ${stockQtyNum} шт.
       </div>`
    : ""
}
        </div>
      </div>

      <div class="cartPrice">${formatPrice(p.price)} ₴</div>

      <div class="qtyBox">
        <button class="qtyBtn" data-act="minus" data-key="${escapeHTML(key)}">−</button>
        <div class="qtyNum">${formatQty(qty)}</div>
<button
  class="qtyBtn"
  data-act="plus"
  data-key="${escapeHTML(key)}"
  data-step="${step}"
  ${maxReached ? "disabled" : ""}
>+</button>
      </div>

      <div class="cartSum">${formatPrice(rowSum)} ₴</div>

      <button class="delBtn" title="Видалити" data-act="del" data-key="${escapeHTML(key)}">🗑</button>
    `;
    cartList.appendChild(row);

    if (checkoutPreview && checkoutTotal) {
      const div = document.createElement("div");
      div.className = "chkRow";
      div.innerHTML = `
<img class="chkImg" src="${escapeHTML(productImageSrc(p))}" alt="${escapeHTML(p.title)}">
        <div>
          <div class="chkName">${escapeHTML(p.title)}</div>
          <div class="chkMeta">${formatQty(qty)} ${escapeHTML(unit)} × ${formatPrice(p.price)} ₴</div>
        </div>
        <div class="chkSum">${formatPrice(rowSum)} ₴</div>
      `;
      checkoutPreview.appendChild(div);
    }
  }

  if (cartItemsCount) cartItemsCount.textContent = formatQty(totalQty);
  if (cartTotal) cartTotal.textContent = formatPrice(totalSum);
  if (checkoutTotal) checkoutTotal.textContent = `${formatPrice(totalSum)} ₴`;
}

function changeQty(key, delta) {
  const cart = getCart();
  const current = Number(cart[key] || 0);
  let next = round1(current + delta);

  const prods = getProds();
  const { id } = parseCartKey(key);
  const p = prods.find((x) => Number(x.id) === Number(id));

if (p) {
  const stock = Number(p.stockQty ?? p.stock_qty ?? 0);
  const limitByStock = Number(p.isCustomOrder || 0) !== 1 && p.unitType === "pcs";

  if (limitByStock && Number.isFinite(stock) && stock >= 0) {
    if (next > stock) {
      next = stock;

      if (cartHint) {
        const productTitle = p.title || p.name || "товару";
        checkoutHint.textContent = "";
        cartHint.textContent = `Для товару "${productTitle}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
      }
    }
  }
}

  if (next <= 0) {
    delete cart[key];
  } else {
    cart[key] = next;
  }

  setCart(cart);
  renderCart();
}

function deleteItem(key) {
  const cart = getCart();
  delete cart[key];
  setCart(cart);
  renderCart();
}

/* events */
cartList?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;

  const act = btn.getAttribute("data-act");
  const key = btn.getAttribute("data-key");
  if (!key) return;

  const prods = getProds();
  const { id } = parseCartKey(key);
  const p = prods.find((x) => Number(x.id) === id);
  const step = p ? stepByUnitType(p.unitType) : 1;

if (act === "minus") {
  if (cartHint) cartHint.textContent = "";
  changeQty(key, -step);
}

if (act === "plus") {
  const cart = getCart();
  const current = Number(cart[key] || 0);
  const stock = Number(p?.stockQty ?? p?.stock_qty ?? 0);
  const limitByStock = p && Number(p.isCustomOrder || 0) !== 1 && p.unitType === "pcs";

  if (limitByStock && Number.isFinite(stock) && stock >= 0 && current >= stock) {
    if (cartHint) {
      const productTitle = p.title || p.name || "товару";
      cartHint.textContent = `Для товару "${productTitle}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
    }
    return;
  }

  if (cartHint) cartHint.textContent = "";
  changeQty(key, +step);
}

if (act === "del") {
  if (cartHint) cartHint.textContent = "";
  deleteItem(key);
}
});

clearCartBtn?.addEventListener("click", () => {
  setCart({});
  renderCart();
});

function openCheckout() {
  const cart = getCart();
  const entries = Object.entries(cart).filter(([, q]) => Number(q) > 0);

  if (!entries.length) {
    if (checkoutHint) checkoutHint.textContent = "Кошик порожній.";
    return;
  }

  document.body.classList.add("modalOpen");
  modal?.setAttribute("aria-hidden", "false");

  if (afterConfirm) afterConfirm.hidden = true;
  if (checkoutHint) checkoutHint.textContent = "";
}

function closeCheckout() {
  document.body.classList.remove("modalOpen");
  modal?.setAttribute("aria-hidden", "true");
}

tgBtn?.addEventListener("click", openCheckout);
closeBtn?.addEventListener("click", closeCheckout);
overlay?.addEventListener("click", closeCheckout);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCheckout();
});

if (cDate) {
  const today = new Date();
  cDate.min = today.toISOString().slice(0, 10);

  cDate.addEventListener("change", () => {
    if (!cDate.value) return;

    const selected = new Date(cDate.value);
    const day = selected.getDay(); // 0 = неділя

    if (day === 0) {
      cDate.value = "";
      if (checkoutHint) {
        checkoutHint.textContent = "Неділя — вихідний. Оберіть інший день.";
      }
    } else {
      if (checkoutHint) {
        checkoutHint.textContent = "";
      }
    }
  });
}

checkoutSendBtn?.addEventListener("click", async () => {
  const city = (cCity?.value || "").trim();
  const addr = (cAddress?.value || "").trim();
  const phone = (cPhone?.value || "").trim();
  const email = (cEmail?.value || "").trim();
  const name = (cName?.value || "").trim();
  const delivery_date = (cDate?.value || "").trim();

  if (!delivery_date) {
    if (checkoutHint) checkoutHint.textContent = "Оберіть дату доставки.";
    return;
  }
  const selectedDate = new Date(delivery_date);
if (selectedDate.getDay() === 0) {
  if (checkoutHint) checkoutHint.textContent = "Неділя — вихідний. Оберіть інший день.";
  return;
}

  if (!city || !addr || !name) {
    if (checkoutHint) checkoutHint.textContent = "Заповніть ім’я, населений пункт і адресу.";
    return;
  }
if (!phone || !email) {
  if (checkoutHint) checkoutHint.textContent = "Телефон і email є обов’язковими.";
  return;
}

  const cart = getCart();
  const entries = Object.entries(cart).filter(([, q]) => Number(q) > 0);

  if (!entries.length) {
    if (checkoutHint) checkoutHint.textContent = "Кошик порожній.";
    return;
  }

  const prods = getProds();
  const items = [];
  for (const [key, qtyRaw] of entries) {
  const qty = Number(qtyRaw);
  const { id } = parseCartKey(key);
  const p = prods.find((x) => Number(x.id) === Number(id));
  if (!p) continue;

if (Number(p.isCustomOrder || 0) !== 1 && p.unitType === "pcs") {
  const stock = Number(p.stockQty || 0);
  if (Number.isFinite(stock) && qty > stock) {
    const msg = `Для товару "${p.title}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
    if (cartHint) cartHint.textContent = msg;
    if (checkoutHint) checkoutHint.textContent = msg;
    return;
  }
}
}

for (const [key, qtyRaw] of entries) {
  const qty = Number(qtyRaw);

  const { id, unit } = parseCartKey(key);

  const p = prods.find((x) => Number(x.id) === Number(id));
  if (!p) continue;

  items.push({
    product_id: Number(id),
    qty: qty,
    unit: unit || "шт"
  });
}

  if (!items.length) {
    if (checkoutHint) checkoutHint.textContent = "Не вдалося сформувати список товарів.";
    return;
  }

  try {
    if (checkoutHint) checkoutHint.textContent = "Надсилаю замовлення...";

    const resp = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Order-Key": ORDER_KEY
      },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        city: city,
        address: addr,
        delivery_date,
        note: "",
        items: items
      })
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msg = data?.error || data?.message || `HTTP ${resp.status}`;
      if (checkoutHint) checkoutHint.textContent = "Помилка: " + msg;
      return;
    }

    let sum = 0;
    const lines = [];
    lines.push(`Замовлення:`);
    lines.push(`ПІБ: ${name}`);
    if (phone) lines.push(`Телефон: ${phone}`);
    if (email) lines.push(`Email: ${email}`);
    lines.push(`Місто: ${city}`);
    lines.push(`Адреса: ${addr}`);
    lines.push(`Дата доставки: ${delivery_date}`);
    lines.push(`--- Товари ---`);

    for (const [key, qtyRaw] of entries) {
      const qty = Number(qtyRaw);
const { id, unit, customNote } = parseCartKey(key);
      const p = prods.find((x) => Number(x.id) === id);
      if (!p) continue;

      const rowSum = Number(p.price) * qty;
      sum += rowSum;

      lines.push(
        `${p.title} — ${formatQty(qty)} ${unit} × ${formatPrice(p.price)}₴ = ${formatPrice(rowSum)}₴`
      );
    }

    lines.push(`---`);
    lines.push(`До оплати: ${formatPrice(sum)}₴`);

    const enc = encodeURIComponent(lines.join("\n"));

    setCart({});
    renderCart();

    if (sendTg) sendTg.href = `${TG_LINK}?text=${enc}`;
    if (sendCall) sendCall.href = `tel:${CALL_PHONE}`;

    if (afterConfirm) afterConfirm.hidden = false;
    if (checkoutHint) checkoutHint.textContent = "Готово! Замовлення створено.";
  } catch (e) {
    if (checkoutHint) checkoutHint.textContent = "Помилка запиту: " + (e?.message || e);
  }
});

async function syncProductsFromApi() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const prods = await res.json();
    if (Array.isArray(prods)) {
      localStorage.setItem(KEY_PRODS, JSON.stringify(prods));
    }
  } catch (e) {
    console.warn("Не вдалося оновити товари з API:", e);
  }
}

(async function initCart() {
  if (callBtn) callBtn.href = `tel:${CALL_PHONE}`;
  if (sendCall) sendCall.href = `tel:${CALL_PHONE}`;

  await syncProductsFromApi();
  renderCart();
})();