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
            ["variant_name", "weight", "size", "name", "quantity"],
            "Standard"
        );
    }

    function getVariantPrice(variant) {
        return Number(
            getValue(
                variant,
                ["selling_price", "sale_price", "price"],
                0
            )
        );
    }

    function getVariantMRP(variant) {
        return Number(
            getValue(
                variant,
                ["mrp", "original_price", "regular_price"],
                getVariantPrice(variant)
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

    function getDiscount(variant) {
        const mrp = getVariantMRP(variant);
        const price = getVariantPrice(variant);

        if (mrp <= 0 || price >= mrp) return 0;

        return Math.round(((mrp - price) / mrp) * 100);
    }

    function formatPrice(value) {
        return Number(value || 0).toFixed(2);
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

        productGrid.innerHTML =
            '<p class="loading-message">Loading products...</p>';

        clearMessage();

        try {
            if (window.shriSupabaseReady) {
                await window.shriSupabaseReady;
            }

            if (!window.shriSupabase) {
                throw new Error("Supabase connection is unavailable.");
            }

            const client = window.shriSupabase;

            const productResult = await client
                .from(PRODUCT_TABLE)
                .select("*");

            if (productResult.error) {
                throw productResult.error;
            }

            let fetchedProducts = (productResult.data || []).filter(isActive);

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

            // Attach active variants to products
            products = fetchedProducts.map(product => {
                const variants = allVariants
                    .filter(variant =>
                        String(variant.product_id) === String(product.id)
                    )
                    .filter(isActive);

                return {
                    ...product,
                    variants: variants
                };
            });

            // Hide products without active variants
            products = products.filter(product =>
                product.variants.length > 0
            );

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

    // Render price details
    function renderPrice(productIndex, variant) {
        const priceElement = document.getElementById(
            `product-price-${productIndex}`
        );

        if (!priceElement) return;

        const price = getVariantPrice(variant);
        const mrp = getVariantMRP(variant);
        const discount = getDiscount(variant);

        priceElement.innerHTML = `
            <strong>₹${formatPrice(price)}</strong>

            ${
                mrp > price
                    ? `<del>₹${formatPrice(mrp)}</del>`
                    : ""
            }

            ${
                discount > 0
                    ? `<span class="product-discount">${discount}% OFF</span>`
                    : ""
            }
        `;
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

            const availableVariants = variants.filter(variant =>
                getVariantStock(variant) > 0
            );

            const firstVariant = availableVariants[0] || variants[0];

            const variantOptions = variants.map((variant, variantIndex) => {
                const price = getVariantPrice(variant);
                const stock = getVariantStock(variant);
                const mrp = getVariantMRP(variant);
                const label = getVariantName(variant);

                return `
                    <option
                        value="${variantIndex}"
                        ${variant === firstVariant ? "selected" : ""}
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        ${escapeHTML(label)} -
                        ₹${formatPrice(price)}
                        ${mrp > price ? `(MRP ₹${formatPrice(mrp)})` : ""}
                        ${stock <= 0 ? "(Out of stock)" : ""}
                    </option>
                `;
            }).join("");

            const noStock = availableVariants.length === 0;

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

                        <div
                            class="product-price"
                            id="product-price-${index}"
                        >
                            ${
                                firstVariant
                                    ? `
                                        <strong>₹${formatPrice(getVariantPrice(firstVariant))}</strong>
                                        ${
                                            getVariantMRP(firstVariant) > getVariantPrice(firstVariant)
                                                ? `<del>₹${formatPrice(getVariantMRP(firstVariant))}</del>`
                                                : ""
                                        }
                                        ${
                                            getDiscount(firstVariant) > 0
                                                ? `<span class="product-discount">${getDiscount(firstVariant)}% OFF</span>`
                                                : ""
                                        }
                                    `
                                    : "Price unavailable"
                            }
                        </div>

                        <label for="variant-${index}">
                            Select Pack Size
                        </label>

                        <select
                            id="variant-${index}"
                            class="product-variant-select"
                            data-product-index="${index}"
                            ${noStock ? "disabled" : ""}
                        >
                            ${variantOptions}
                        </select>

                        <p
                            class="product-stock-message"
                            id="product-stock-${index}"
                        >
                            ${
                                noStock
                                    ? "Currently out of stock"
                                    : "Available"
                            }
                        </p>

                        <button
                            type="button"
                            class="primary-button"
                            data-add-product="${index}"
                            ${noStock ? "disabled" : ""}
                        >
                            ${noStock ? "Out of Stock" : "Add to Cart"}
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
                    const productIndex = Number(this.dataset.productIndex);
                    const variantIndex = Number(this.value);

                    const product = products[productIndex];

                    if (!product) return;

                    const variant = product.variants[variantIndex];

                    if (!variant) return;

                    renderPrice(productIndex, variant);

                    const stock = getVariantStock(variant);

                    const stockElement = document.getElementById(
                        `product-stock-${productIndex}`
                    );

                    const addButton = productGrid.querySelector(
                        `[data-add-product="${productIndex}"]`
                    );

                    if (stockElement) {
                        stockElement.textContent = stock > 0
                            ? `Available: ${stock} packs`
                            : "Currently out of stock";
                    }

                    if (addButton) {
                        addButton.disabled = stock <= 0;
                        addButton.textContent = stock <= 0
                            ? "Out of Stock"
                            : "Add to Cart";
                    }
                });
            });

        productGrid.querySelectorAll("[data-add-product]")
            .forEach(button => {
                button.addEventListener("click", function () {
                    const productIndex = Number(this.dataset.addProduct);

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
            mrp: getVariantMRP(variant),
            discount: getDiscount(variant),
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

            alert(
                "Cart service is unavailable. Please refresh the page."
            );
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

        getVariants: function (productId) {
            const product = this.getById(productId);
            return product ? product.variants : [];
        },

        refresh: loadProducts
    };

    // Load after DOM is ready
    document.addEventListener("DOMContentLoaded", loadProducts);

})();
