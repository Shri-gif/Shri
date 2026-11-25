
/* =========================================
   SHRI SPICES - PRODUCT MANAGEMENT
   File: js/products.js
   ========================================= */

(function () {
    "use strict";

    const PRODUCT_TABLE = "products";
    const VARIANT_TABLE = "product_variants";

    let products = [];

    const grid = () => document.getElementById("productGrid");

    // Safe HTML escaping
    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[char];
        });
    }

    function getValue(object, keys, fallback = "") {
        for (const key of keys) {
            if (
                object &&
                object[key] !== undefined &&
                object[key] !== null &&
                object[key] !== ""
            ) {
                return object[key];
            }
        }

        return fallback;
    }

    function isActive(record) {
        if (record.is_active !== undefined) {
            return record.is_active === true;
        }

        if (record.active !== undefined) {
            return record.active === true;
        }

        return true;
    }

    function getProductImage(product) {
        return getValue(
            product,
            ["image_url", "image", "photo_url", "thumbnail"],
            "assets/images/logo.png"
        );
    }

    function getProductName(product) {
        return getValue(
            product,
            ["name", "product_name", "title"],
            "Unnamed Product"
        );
    }

    function getVariants(product) {
        return product.variants || product.product_variants || [];
    }

    function getVariantName(variant) {
        return getValue(
            variant,
            ["weight", "variant_name", "name", "size", "quantity"],
            "Standard"
        );
    }

    function getVariantPrice(variant) {
        return Number(
            getValue(
                variant,
                ["price", "selling_price", "sale_price"],
                0
            )
        );
    }

    function getVariantStock(variant) {
        return Number(
            getValue(
                variant,
                ["stock", "stock_quantity", "quantity_available"],
                0
            )
        );
    }

    function showMessage(message, isError = false) {
        const element = document.getElementById("productError");

        if (!element) return;

        element.hidden = false;
        element.textContent = message;
        element.style.color = isError ? "#c62828" : "#218838";
    }

    function clearMessage() {
        const element = document.getElementById("productError");

        if (element) {
            element.hidden = true;
            element.textContent = "";
        }
    }

    // Load products and variants
    async function loadProducts() {
        const productGrid = grid();

        if (!productGrid) return;

        if (
            !window.shriSupabaseReady ||
            !window.shriSupabase
        ) {
            productGrid.innerHTML =
                '<p class="empty-message">Unable to connect to the product service.</p>';

            showMessage("Supabase connection is unavailable.", true);
            return;
        }

        productGrid.innerHTML =
            '<p class="loading-message">Loading products...</p>';

        clearMessage();

        try {
            const client = window.shriSupabase;

            const productResult = await client
                .from(PRODUCT_TABLE)
                .select("*");

            if (productResult.error) {
                throw productResult.error;
            }

            let fetchedProducts = productResult.data || [];

            fetchedProducts = fetchedProducts.filter(isActive);

            if (fetchedProducts.length === 0) {
                products = [];

                productGrid.innerHTML =
                    '<p class="empty-message">No products available right now.</p>';

                return;
            }

            // Load variants separately
            const productIds = fetchedProducts
                .map(product => product.id)
                .filter(Boolean);

            const variantResult = await client
                .from(VARIANT_TABLE)
                .select("*")
                .in("product_id", productIds);

            if (variantResult.error) {
                throw variantResult.error;
            }

            const allVariants = variantResult.data || [];

            // Attach variants to their products
            products = fetchedProducts.map(product => {

                const variants = allVariants.filter(variant =>
                    String(variant.product_id) === String(product.id)
                ).filter(isActive);

                return {
                    ...product,
                    variants: variants
                };

            });

            renderProducts();

        } catch (error) {

            console.error(
                "Shri Spices: Product loading failed:",
                error
            );

            productGrid.innerHTML =
                '<p class="empty-message">Products could not be loaded.</p>';

            showMessage(
                error.message || "Please check your database configuration.",
                true
            );

        }
    }

    // Render product cards
    function renderProducts() {
        const productGrid = grid();

        if (!productGrid) return;

        if (!products.length) {
            productGrid.innerHTML =
                '<p class="empty-message">No products available.</p>';
            return;
        }

        productGrid.innerHTML = products.map((product, index) => {

            const variants = getVariants(product);

            const description = getValue(
                product,
                ["description", "details", "short_description"],
                "Premium quality spices."
            );

            const image = getProductImage(product);

            const variantOptions = variants.map((variant, variantIndex) => {

                const price = getVariantPrice(variant);
                const stock = getVariantStock(variant);
                const label = getVariantName(variant);

                return `
                    <option
                        value="${variantIndex}"
                        ${variantIndex === 0 ? "selected" : ""}
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        ${escapeHTML(label)} -
                        ₹${price.toFixed(2)}
                        ${stock <= 0 ? "(Out of stock)" : ""}
                    </option>
                `;

            }).join("");

            const firstVariant = variants[0];

            const initialPrice = firstVariant
                ? getVariantPrice(firstVariant)
                : 0;

            const noVariants = variants.length === 0;

            return `
                <article class="product-card">

                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(getProductName(product))}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='assets/images/logo.png';"
                    >

                    <div class="product-card-content">

                        <h3>${escapeHTML(getProductName(product))}</h3>

                        <p>${escapeHTML(description)}</p>

                        <div class="product-price"
                            id="product-price-${index}">
                            ₹${initialPrice.toFixed(2)}
                        </div>

                        ${
                            noVariants
                            ? '<p>Variants currently unavailable.</p>'
                            : `
                                <label for="variant-${index}">
                                    Select Weight
                                </label>

                                <select
                                    id="variant-${index}"
                                    class="product-variant-select"
                                    data-product-index="${index}"
                                >
                                    ${variantOptions}
                                </select>
                            `
                        }

                        <button
                            type="button"
                            class="primary-button"
                            data-add-product="${index}"
                            ${noVariants ? "disabled" : ""}
                        >
                            Add to Cart
                        </button>

                    </div>

                </article>
            `;

        }).join("");

        attachProductEvents();
    }

    // Product card interactions
    function attachProductEvents() {

        const productGrid = grid();

        if (!productGrid) return;

        productGrid.querySelectorAll(".product-variant-select")
            .forEach(select => {

                select.addEventListener("change", function () {

                    const productIndex = Number(
                        this.dataset.productIndex
                    );

                    const variantIndex = Number(this.value);

                    const product = products[productIndex];

                    if (!product) return;

                    const variant = product.variants[variantIndex];

                    if (!variant) return;

                    const priceElement = document.getElementById(
                        `product-price-${productIndex}`
                    );

                    if (priceElement) {
                        priceElement.textContent =
                            "₹" + getVariantPrice(variant).toFixed(2);
                    }

                });

            });

        productGrid.querySelectorAll("[data-add-product]")
            .forEach(button => {

                button.addEventListener("click", function () {

                    const productIndex = Number(
                        this.dataset.addProduct
                    );

                    addProductToCart(productIndex);

                });

            });

    }

    // Add selected product variant to cart
    function addProductToCart(productIndex) {

        const product = products[productIndex];

        if (!product) return;

        const selector = document.getElementById(
            `variant-${productIndex}`
        );

        if (!selector) return;

        const variantIndex = Number(selector.value);

        const variant = product.variants[variantIndex];

        if (!variant) return;

        if (getVariantStock(variant) <= 0) {
            alert("This variant is currently out of stock.");
            return;
        }

        const cartItem = {
            product_id: product.id,
            variant_id: variant.id,
            name: getProductName(product),
            variant: getVariantName(variant),
            price: getVariantPrice(variant),
            image: getProductImage(product),
            quantity: 1
        };

        if (
            window.ShriCart &&
            typeof window.ShriCart.add === "function"
        ) {

            window.ShriCart.add(cartItem);

        } else {

            console.error("ShriCart is not initialized yet.");
            alert("Cart service is unavailable. Please refresh the page.");

        }

    }

    // Public API
    window.ShriProducts = {
        load: loadProducts,

        getAll: function () {
            return products;
        },

        getById: function (id) {
            return products.find(
                product => String(product.id) === String(id)
            ) || null;
        },

        refresh: loadProducts
    };

    // Load after DOM is ready
    document.addEventListener("DOMContentLoaded", loadProducts);

})();
