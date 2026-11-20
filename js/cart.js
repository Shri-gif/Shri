(function () {
  "use strict";

  const CART_KEY = "shri_spices_cart";

  let cartItems = [];

  function loadCart() {
    try {
      const savedCart = localStorage.getItem(CART_KEY);
      cartItems = savedCart ? JSON.parse(savedCart) : [];

      if (!Array.isArray(cartItems)) {
        cartItems = [];
      }
    } catch (error) {
      console.error("Cart loading error:", error);
      cartItems = [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error("Cart saving error:", error);
    }
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(amount) || 0);
  }

  function getTotal() {
    return cartItems.reduce((total, item) => {
      return total + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);
  }

  function getItemCount() {
    return cartItems.reduce((total, item) => {
      return total + (Number(item.quantity) || 0);
    }, 0);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    });
  }

  function add(item) {
    if (!item || !item.product_id || !item.variant_id) {
      console.error("Invalid cart item:", item);
      return false;
    }

    const price = Number(item.price);
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

    if (!Number.isFinite(price) || price < 0) {
      console.error("Invalid product price.");
      return false;
    }

    const existingItem = cartItems.find(function (cartItem) {
      return String(cartItem.product_id) === String(item.product_id) &&
        String(cartItem.variant_id) === String(item.variant_id);
    });

    if (existingItem) {
      existingItem.quantity = (Number(existingItem.quantity) || 0) + quantity;
    } else {
      cartItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        name: String(item.name || "Product"),
        variant: String(item.variant || ""),
        price: price,
        image: String(item.image || ""),
        quantity: quantity
      });
    }

    saveCart();
    render();
    return true;
  }

  function updateQuantity(productId, variantId, quantity) {
    const item = cartItems.find(function (cartItem) {
      return String(cartItem.product_id) === String(productId) &&
        String(cartItem.variant_id) === String(variantId);
    });

    if (!item) return;

    const newQuantity = parseInt(quantity, 10);

    if (!Number.isFinite(newQuantity) || newQuantity < 1) {
      remove(productId, variantId);
      return;
    }

    item.quantity = newQuantity;
    saveCart();
    render();
  }

  function remove(productId, variantId) {
    cartItems = cartItems.filter(function (item) {
      return !(String(item.product_id) === String(productId) &&
        String(item.variant_id) === String(variantId));
    });

    saveCart();
    render();
  }

  function clear() {
    cartItems = [];
    saveCart();
    render();
  }

  function getItems() {
    return cartItems.map(function (item) {
      return { ...item };
    });
  }

  function render() {
    const cartContainer = document.getElementById("cart-items");
    const totalElement = document.getElementById("total");
    const emptyMessage = document.getElementById("cart-empty-message");

    if (!cartContainer) return;

    if (cartItems.length === 0) {
      cartContainer.innerHTML = "";
      if (emptyMessage) emptyMessage.style.display = "block";
    } else {
      if (emptyMessage) emptyMessage.style.display = "none";

      cartContainer.innerHTML = cartItems.map(function (item) {
        const productId = escapeHTML(item.product_id);
        const variantId = escapeHTML(item.variant_id);
        const image = escapeHTML(item.image);
        const name = escapeHTML(item.name);
        const variant = escapeHTML(item.variant);
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const price = Number(item.price) || 0;

        return `
          <div class="cart-item"
               data-product-id="${productId}"
               data-variant-id="${variantId}">

            <div class="cart-item-image">
              ${
                image
                  ? `<img src="${image}" alt="${name}" loading="lazy">`
                  : `<span>🌶️</span>`
              }
            </div>

            <div class="cart-item-details">
              <h4>${name}</h4>
              <p>${variant}</p>
              <strong>${formatPrice(price)}</strong>

              <div class="cart-quantity">
                <button type="button"
                        class="cart-qty-btn"
                        data-action="decrease"
                        aria-label="Decrease quantity">−</button>

                <input type="number"
                       class="cart-qty-input"
                       min="1"
                       step="1"
                       value="${quantity}"
                       aria-label="Quantity">

                <button type="button"
                        class="cart-qty-btn"
                        data-action="increase"
                        aria-label="Increase quantity">+</button>
              </div>
            </div>

            <div class="cart-item-actions">
              <strong>${formatPrice(price * quantity)}</strong>
              <button type="button"
                      class="cart-remove-btn"
                      data-action="remove">
                Remove
              </button>
            </div>
          </div>
        `;
      }).join("");
    }

    if (totalElement) {
      totalElement.textContent = formatPrice(getTotal());
    }

    updateCartCount();
  }

  function updateCartCount() {
    document.querySelectorAll("[data-cart-count]").forEach(function (element) {
      element.textContent = getItemCount();
    });
  }

  function handleCartClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const cartItem = button.closest(".cart-item");
    if (!cartItem) return;

    const productId = cartItem.dataset.productId;
    const variantId = cartItem.dataset.variantId;
    const action = button.dataset.action;

    const item = cartItems.find(function (cartItem) {
      return String(cartItem.product_id) === String(productId) &&
        String(cartItem.variant_id) === String(variantId);
    });

    if (!item) return;

    if (action === "remove") {
      remove(productId, variantId);
    } else if (action === "increase") {
      updateQuantity(productId, variantId, item.quantity + 1);
    } else if (action === "decrease") {
      updateQuantity(productId, variantId, item.quantity - 1);
    }
  }

  function handleQuantityChange(event) {
    if (!event.target.classList.contains("cart-qty-input")) return;

    const cartItem = event.target.closest(".cart-item");
    if (!cartItem) return;

    updateQuantity(
      cartItem.dataset.productId,
      cartItem.dataset.variantId,
      event.target.value
    );
  }

  function connectCheckoutButtons() {
    const checkoutButton = document.getElementById("checkoutBtn");
    const upiButton = document.getElementById("upiPayBtn");
    const whatsappButton = document.getElementById("whatsappOrderBtn");

    if (checkoutButton) {
      checkoutButton.addEventListener("click", function () {
        if (window.ShriCheckout && typeof window.ShriCheckout.checkout === "function") {
          window.ShriCheckout.checkout();
        } else {
          console.error("Checkout module is not available.");
        }
      });
    }

    if (upiButton) {
      upiButton.addEventListener("click", function () {
        if (window.ShriCheckout && typeof window.ShriCheckout.payViaUPI === "function") {
          window.ShriCheckout.payViaUPI();
        } else {
          console.error("UPI payment module is not available.");
        }
      });
    }

    if (whatsappButton) {
      whatsappButton.addEventListener("click", function () {
        if (window.ShriCheckout && typeof window.ShriCheckout.orderOnWhatsApp === "function") {
          window.ShriCheckout.orderOnWhatsApp();
        } else {
          console.error("WhatsApp order module is not available.");
        }
      });
    }
  }

  loadCart();

  window.ShriCart = {
    add: add,
    remove: remove,
    clear: clear,
    render: render,
    getItems: getItems,
    getTotal: getTotal,
    getItemCount: getItemCount,
    updateQuantity: updateQuantity
  };

  document.addEventListener("DOMContentLoaded", function () {
    const cartContainer = document.getElementById("cart-items");

    if (cartContainer) {
      cartContainer.addEventListener("click", handleCartClick);
      cartContainer.addEventListener("change", handleQuantityChange);
    }

    render();
    connectCheckoutButtons();
  });

})();
