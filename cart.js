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
  const variantId = Number(parts[1] || 0);
  const customNote = decodeURIComponent(parts.slice(2).join("|") || "");
  return { id, variantId, customNote };
}

function getCartItemData(cartValue) {
  if (typeof cartValue === "number") {
    return { qty: Number(cartValue) || 0 };
  }

  if (cartValue && typeof cartValue === "object") {
    return {
      qty: Number(cartValue.qty || 0),
      unit: String(cartValue.unit || ""),
      price: Number(cartValue.price || 0),
      variantId: Number(cartValue.variantId || 0),
      variantLabel: String(cartValue.variantLabel || ""),
      title: String(cartValue.title || ""),
      img: String(cartValue.img || ""),
      brand: String(cartValue.brand || ""),
      catId: cartValue.catId ?? null,
      isCustomOrder: Number(cartValue.isCustomOrder || 0),
      stockQty: Number(cartValue.stockQty ?? 0),
    };
  }

  return { qty: 0 };
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

function productImageSrc(p) {
  return p?.img
    ? p.img
    : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='220' viewBox='0 0 300 220'><rect width='300' height='220' fill='%23eef2f7'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='18'>Немає фото</text></svg>";
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

  const entries = Object.entries(cart).filter(([, value]) => {
    const item = getCartItemData(value);
    return Number(item.qty) > 0;
  });

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

  for (const [key, rawItem] of entries) {
    const item = getCartItemData(rawItem);
    let qty = Number(item.qty || 0);

    const { id, variantId } = parseCartKey(key);

    const p = prods.find((x) => Number(x.id) === Number(id));
    if (!p) continue;

    const variant = Array.isArray(p.variants)
      ? p.variants.find((v, index) => Number(v.id ?? index) === Number(variantId))
      : null;

    const activeUnit = item.unit || item.variantLabel || variant?.label || p.unit || "шт";
    const activePrice = Number(item.price || variant?.price || p.price || 0);
    const activeStock = Number(item.stockQty || variant?.stockQty || p.stockQty || 0);
    const isCustom = Number(item.isCustomOrder || p.isCustomOrder || 0) === 1;

    const stock = activeStock;
    const limitByStock = !isCustom;

    if (limitByStock && Number.isFinite(stock) && stock >= 0 && qty > stock) {
      qty = stock;

      const freshCart = getCart();
      if (qty > 0) {
        const prevItem = getCartItemData(freshCart[key]);
        freshCart[key] = {
          ...prevItem,
          qty,
        };
      } else {
        delete freshCart[key];
      }
      setCart(freshCart);

      if (cartHint) {
        const productTitle = p.title || p.name || "товару";
        cartHint.textContent = `Для товару "${productTitle}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
      }
    }

    const cat = cats.find((c) => Number(c.id) === Number(p.catId));
    const rowSum = activePrice * qty;

    totalQty += qty;
    totalSum += rowSum;

    const stockQtyNum = Number(activeStock || 0);

    const stockText = isCustom
      ? "Під замовлення"
      : stockQtyNum > 0
        ? `В наявності: ${stockQtyNum}`
        : "Немає в наявності";

    const limitedByStock =
      !isCustom &&
      Number.isFinite(stockQtyNum) &&
      stockQtyNum >= 0;

    const overStock = limitedByStock && qty > stockQtyNum;
    const maxReached =
      limitedByStock && qty >= stockQtyNum && stockQtyNum > 0;

    const row = document.createElement("div");
    row.className = "cartRow";
    row.innerHTML = `
      <img class="cartImg" src="${escapeHTML(productImageSrc(p))}" alt="${escapeHTML(p.title)}">
      <div class="cartInfo">
        <div class="cartTitle">${escapeHTML(p.title)}</div>
        <div class="cartMeta">
          ${escapeHTML(cat ? cat.name : "Категорія")} • ${escapeHTML(item.brand || p.brand || "")} • ${escapeHTML(activeUnit)} • ${escapeHTML(stockText)}
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

      <div class="cartPrice">${formatPrice(activePrice)} ₴</div>

      <div class="qtyBox">
        <button class="qtyBtn" data-act="minus" data-key="${escapeHTML(key)}">−</button>
        <div class="qtyNum">${formatQty(qty)}</div>
        <button
          class="qtyBtn"
          data-act="plus"
          data-key="${escapeHTML(key)}"
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
          <div class="chkMeta">${formatQty(qty)} ${escapeHTML(activeUnit)} × ${formatPrice(activePrice)} ₴</div>
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
  const current = Number(getCartItemData(cart[key]).qty || 0);
  let next = round1(current + delta);

  const prods = getProds();
  const { id, variantId } = parseCartKey(key);
  const p = prods.find((x) => Number(x.id) === Number(id));

  if (p) {
    const variant = Array.isArray(p.variants)
      ? p.variants.find((v, index) => Number(v.id ?? index) === Number(variantId))
      : null;

    const stock = Number(variant?.stockQty ?? p.stockQty ?? 0);
    const limitByStock = Number(p.isCustomOrder || 0) !== 1;

    if (limitByStock && Number.isFinite(stock) && stock >= 0) {
      if (next > stock) {
        next = stock;

        if (cartHint) {
          const productTitle = p.title || p.name || "товару";
          if (checkoutHint) checkoutHint.textContent = "";
          cartHint.textContent = `Для товару "${productTitle}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
        }
      }
    }
  }

  if (next <= 0) {
    delete cart[key];
  } else {
    const prevItem = getCartItemData(cart[key]);
    cart[key] = {
      ...prevItem,
      qty: next,
    };
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
  const { id, variantId } = parseCartKey(key);
  const p = prods.find((x) => Number(x.id) === id);

  if (act === "minus") {
    changeQty(key, -1);
    return;
  }

  if (act === "plus") {
    const variant = Array.isArray(p?.variants)
      ? p.variants.find((v, index) => Number(v.id ?? index) === Number(variantId))
      : null;

    const stock = Number(variant?.stockQty ?? p?.stockQty ?? 0);
    const limitByStock = p && Number(p.isCustomOrder || 0) !== 1;

    if (limitByStock) {
      const cart = getCart();
      const current = Number(getCartItemData(cart[key]).qty || 0);

      if (Number.isFinite(stock) && stock >= 0 && current >= stock) {
        if (cartHint) {
          const productTitle = p?.title || p?.name || "товару";
          cartHint.textContent = `Для товару "${productTitle}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
        }
        return;
      }
    }

    changeQty(key, 1);
    return;
  }

  if (act === "del") {
    deleteItem(key);
  }
});

clearCartBtn?.addEventListener("click", () => {
  setCart({});
  renderCart();
});

function openCheckout() {
  const cart = getCart();
  const entries = Object.entries(cart).filter(([, value]) => {
    const item = getCartItemData(value);
    return Number(item.qty) > 0;
  });

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
    const day = selected.getDay();

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
  const entries = Object.entries(cart).filter(([, value]) => {
    const item = getCartItemData(value);
    return Number(item.qty) > 0;
  });

  if (!entries.length) {
    if (checkoutHint) checkoutHint.textContent = "Кошик порожній.";
    return;
  }

  const prods = getProds();
  const items = [];

  for (const [key, rawItem] of entries) {
    const item = getCartItemData(rawItem);
    const qty = Number(item.qty || 0);
    const { id, variantId } = parseCartKey(key);

    const p = prods.find((x) => Number(x.id) === Number(id));
    if (!p) continue;

    const variant = Array.isArray(p.variants)
      ? p.variants.find((v, index) => Number(v.id ?? index) === Number(variantId))
      : null;

    const unit = item.unit || item.variantLabel || variant?.label || p.unit || "шт";
    const price = Number(item.price || variant?.price || p.price || 0);
    const stock = Number(item.stockQty || variant?.stockQty || p.stockQty || 0);
    const isCustom = Number(item.isCustomOrder || p.isCustomOrder || 0) === 1;

    if (!isCustom && Number.isFinite(stock) && qty > stock) {
      const msg = `Для товару "${p.title}" в наявності ${stock} шт. Можна додати тільки ${stock} шт.`;
      if (cartHint) cartHint.textContent = msg;
      if (checkoutHint) checkoutHint.textContent = msg;
      return;
    }

    items.push({
      product_id: Number(id),
      variant_id: variant ? Number(variant.id ?? 0) : 0,
      variant_label: unit,
      qty,
      unit,
      price,
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
        "X-Order-Key": ORDER_KEY,
      },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        city,
        address: addr,
        delivery_date,
        note: "",
        items,
      }),
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

    for (const [key, rawItem] of entries) {
      const item = getCartItemData(rawItem);
      const qty = Number(item.qty || 0);
      const { id, variantId, customNote } = parseCartKey(key);

      const p = prods.find((x) => Number(x.id) === Number(id));
      if (!p) continue;

      const variant = Array.isArray(p.variants)
        ? p.variants.find((v, index) => Number(v.id ?? index) === Number(variantId))
        : null;

      const unit = item.unit || item.variantLabel || variant?.label || p.unit || "шт";
      const price = Number(item.price || variant?.price || p.price || 0);
      const rowSum = price * qty;

      sum += rowSum;

      lines.push(
        `${p.title} — ${formatQty(qty)} ${unit} × ${formatPrice(price)}₴ = ${formatPrice(rowSum)}₴`
      );

      if (customNote) {
        lines.push(`Уточнення: ${customNote}`);
      }
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
    if (checkoutHint) {
      checkoutHint.textContent = "Помилка запиту: " + (e?.message || e);
    }
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