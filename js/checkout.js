(function () {
  "use strict";

  const CONFIG = window.SHRI_CONFIG || {};

  const WHATSAPP_NUMBER = String(
    CONFIG.whatsappNumber || "917379969545"
  ).replace(/\D/g, "");

  const UPI_ID = String(
    CONFIG.upiId || "vishuclasse@okicici"
  );

  const MERCHANT_NAME = "Shri Spices";

  function getCartItems() {
    if (!window.ShriCart) return [];
    return window.ShriCart.getItems();
  }

  function getCartTotal() {
    if (!window.ShriCart) return 0;
    return window.ShriCart.getTotal();
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(amount) || 0);
  }

  function showMessage(message) {
    alert(message);
  }

  function createOrderMessage(items, total) {
    let message = "Namaste Shri Spices!\n\n";
    message += "I want to place an order:\n\n";

    items.forEach(function (item, index) {
      message += `${index + 1}. ${item.name}\n`;
      message += `   Variant: ${item.variant || "Standard"}\n`;
      message += `   Quantity: ${item.quantity}\n`;
      message += `   Price: ${formatPrice(item.price * item.quantity)}\n\n`;
    });

    message += `Total Amount: ${formatPrice(total)}\n\n`;
    message += "Please confirm availability and delivery details.";

    return message;
  }

  function orderOnWhatsApp() {
    const items = getCartItems();

    if (items.length === 0) {
      showMessage("Your cart is empty. Please add products first.");
      return;
    }

    if (!WHATSAPP_NUMBER) {
      showMessage("WhatsApp number is not configured.");
      return;
    }

    const message = createOrderMessage(items, getCartTotal());
    const url = "https://wa.me/" + WHATSAPP_NUMBER +
      "?text=" + encodeURIComponent(message);

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function payViaUPI() {
    const items = getCartItems();

    if (items.length === 0) {
      showMessage("Your cart is empty. Please add products first.");
      return;
    }

    if (!UPI_ID || !UPI_ID.includes("@")) {
      showMessage("Valid UPI ID is not configured.");
      return;
    }

    const total = getCartTotal();

    if (!Number.isFinite(total) || total <= 0) {
      showMessage("Invalid payment amount.");
      return;
    }

    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: MERCHANT_NAME,
      am: total.toFixed(2),
      cu: "INR",
      tn: "Shri Spices Order"
    });

    const upiUrl = "upi://pay?" + params.toString();

    window.location.href = upiUrl;
  }

  function checkout() {
    const items = getCartItems();

    if (items.length === 0) {
      showMessage("Your cart is empty. Please add products first.");
      return;
    }

    const message = createOrderMessage(items, getCartTotal());

    const encodedMessage = encodeURIComponent(message);

    const whatsappUrl = "https://wa.me/" +
      WHATSAPP_NUMBER +
      "?text=" +
      encodedMessage;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  window.ShriCheckout = {
    checkout: checkout,
    payViaUPI: payViaUPI,
    orderOnWhatsApp: orderOnWhatsApp
  };

})();
