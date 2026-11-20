(function () {
  "use strict";

  let supabase = null;
  let products = [];
  let currentVariants = [];
  let deletedVariantIds = [];

  const $ = function (id) {
    return document.getElementById(id);
  };

  function showMessage(id, message, isError) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#c62828" : "#287a3d";
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

  function money(value) {
    return Number(value || 0).toFixed(2);
  }

  function getVariantName(variant) {
    return variant.variant_name ||
      variant.weight ||
      variant.size ||
      variant.name ||
      variant.quantity ||
      "";
  }

  function getVariantPrice(variant) {
    return variant.selling_price ??
      variant.sale_price ??
      variant.price ??
      0;
  }

  function getVariantStock(variant) {
    return variant.stock ??
      variant.stock_quantity ??
      variant.quantity_available ??
      0;
  }

  async function initializeSupabase() {
    if (window.shriSupabaseReady) {
      await window.shriSupabaseReady;
    }

    if (!window.shriSupabase) {
      throw new Error("Supabase connection is unavailable.");
    }

    supabase = window.shriSupabase;
  }

  async function checkAdminSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    const session = data.session;

    if (!session) {
      showLogin();
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id, role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminError) throw adminError;

    if (!admin) {
      await supabase.auth.signOut();
      showLogin();

      showMessage(
        "adminLoginMessage",
        "This account is not authorized as an administrator.",
        true
      );

      return;
    }

    showDashboard();
    await loadDashboard();
  }

  function showLogin() {
    $("adminLoginSection").hidden = false;
    $("adminDashboardSection").hidden = true;
  }

  function showDashboard() {
    $("adminLoginSection").hidden = true;
    $("adminDashboardSection").hidden = false;
  }

  async function login(event) {
    event.preventDefault();

    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;
    const button = $("adminLoginButton");

    if (!email || !password) {
      showMessage("adminLoginMessage", "Enter email and password.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "Signing in...";

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      await checkAdminSession();

    } catch (error) {
      console.error("Admin login error:", error);

      showMessage(
        "adminLoginMessage",
        error.message || "Login failed. Please try again.",
        true
      );
    } finally {
      button.disabled = false;
      button.textContent = "Login";
    }
  }

  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      showLogin();
      $("adminLoginForm").reset();

    } catch (error) {
      console.error("Admin logout error:", error);
      alert("Could not log out. Please try again.");
    }
  }

  async function loadDashboard() {
    await Promise.all([
      loadProducts(),
      loadStats(),
      loadLeads()
    ]);
  }

  async function loadStats() {
    try {
      const [productsResult, ordersResult, leadsResult] =
        await Promise.all([
          supabase.from("products")
            .select("id", { count: "exact", head: true }),

          supabase.from("orders")
            .select("id", { count: "exact", head: true }),

          supabase.from("b2b_leads")
            .select("id", { count: "exact", head: true })
        ]);

      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (leadsResult.error) throw leadsResult.error;

      $("adminTotalProducts").textContent = productsResult.count ?? 0;
      $("adminTotalOrders").textContent = ordersResult.count ?? 0;
      $("adminTotalLeads").textContent = leadsResult.count ?? 0;

    } catch (error) {
      console.error("Dashboard stats error:", error);
    }
  }

  async function loadProducts() {
    const tbody = $("adminProductsTableBody");

    tbody.innerHTML =
      '<tr><td colspan="4">Loading products...</td></tr>';

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      products = data || [];

      $("adminTotalProducts").textContent = products.length;

      if (products.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="4">No products found.</td></tr>';
        return;
      }

      tbody.innerHTML = products.map(function (product) {
        const status = product.is_active ? "Active" : "Inactive";

        return `
          <tr>
            <td>${escapeHTML(product.name || "")}</td>
            <td>${escapeHTML(product.slug || "")}</td>
            <td>${status}</td>
            <td>
              <button
                type="button"
                class="btn btn-secondary admin-edit-product"
                data-id="${escapeHTML(product.id)}">
                Edit
              </button>
            </td>
          </tr>
        `;
      }).join("");

    } catch (error) {
      console.error("Products loading error:", error);

      tbody.innerHTML =
        '<tr><td colspan="4">Could not load products.</td></tr>';
    }
  }

  // -----------------------------
  // VARIANT MANAGEMENT
  // -----------------------------

  function renderVariantRow(variant) {
    const tbody = $("adminVariantsTableBody");
    const noRow = $("adminNoVariantsRow");

    if (noRow) noRow.remove();

    const row = document.createElement("tr");

    row.className = "admin-variant-row";
    row.dataset.variantId = variant.id || "";

    const name = getVariantName(variant);
    const mrp = variant.mrp ?? variant.original_price ?? "";
    const price = getVariantPrice(variant);
    const stock = getVariantStock(variant);

    row.innerHTML = `
      <td>
        <input
          type="text"
          class="variant-name"
          value="${escapeHTML(name)}"
          placeholder="100g / 200g / 1kg"
          required
        >
      </td>

      <td>
        <input
          type="number"
          class="variant-mrp"
          value="${escapeHTML(mrp)}"
          min="0"
          step="0.01"
          placeholder="MRP"
          required
        >
      </td>

      <td>
        <input
          type="number"
          class="variant-price"
          value="${escapeHTML(price)}"
          min="0"
          step="0.01"
          placeholder="Selling price"
          required
        >
        <small class="variant-discount"></small>
      </td>

      <td>
        <input
          type="number"
          class="variant-stock"
          value="${escapeHTML(stock)}"
          min="0"
          step="1"
          placeholder="Stock"
          required
        >
      </td>

      <td>
        <input
          type="checkbox"
          class="variant-active"
          ${variant.is_active !== false && variant.active !== false ? "checked" : ""}
        >
      </td>

      <td>
        <button
          type="button"
          class="btn btn-secondary admin-remove-variant">
          Remove
        </button>
      </td>
    `;

    tbody.appendChild(row);
    updateVariantDiscount(row);
  }

  function addVariant() {
    renderVariantRow({
      variant_name: "",
      mrp: "",
      selling_price: "",
      stock: 0,
      is_active: true
    });
  }

  function updateVariantDiscount(row) {
    const mrp = Number(row.querySelector(".variant-mrp").value);
    const price = Number(row.querySelector(".variant-price").value);
    const output = row.querySelector(".variant-discount");

    if (!mrp || !price || mrp <= 0 || price > mrp) {
      output.textContent = "";
      return;
    }

    const discount = ((mrp - price) / mrp) * 100;

    output.textContent = discount > 0
      ? Math.round(discount) + "% off"
      : "No discount";
  }

  function clearVariants() {
    $("adminVariantsTableBody").innerHTML = `
      <tr id="adminNoVariantsRow">
        <td colspan="6">
          No pack sizes added yet. Click Add Pack Size.
        </td>
      </tr>
    `;

    currentVariants = [];
    deletedVariantIds = [];
  }

  async function loadVariants(productId) {
    clearVariants();

    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId);

    if (error) {
      console.error("Variant loading error:", error);

      showMessage(
        "adminVariantMessage",
        "Could not load pack sizes: " + error.message,
        true
      );

      return;
    }

    currentVariants = data || [];

    if (currentVariants.length === 0) return;

    $("adminVariantsTableBody").innerHTML = "";

    currentVariants.forEach(function (variant) {
      renderVariantRow(variant);
    });
  }

  function collectVariants() {
    const rows = Array.from(
      $("adminVariantsTableBody").querySelectorAll(".admin-variant-row")
    );

    const variants = [];

    for (const row of rows) {
      const name = row.querySelector(".variant-name").value.trim();
      const mrp = Number(row.querySelector(".variant-mrp").value);
      const price = Number(row.querySelector(".variant-price").value);
      const stock = Number(row.querySelector(".variant-stock").value);
      const active = row.querySelector(".variant-active").checked;

      if (!name) {
        throw new Error("Enter a pack size for every variant.");
      }

      if (!Number.isFinite(mrp) || mrp <= 0) {
        throw new Error("Enter a valid MRP for " + name + ".");
      }

      if (!Number.isFinite(price) || price <= 0 || price > mrp) {
        throw new Error(
          "Selling price must be greater than zero and cannot exceed MRP for " +
          name + "."
        );
      }

      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error("Enter valid stock quantity for " + name + ".");
      }

      variants.push({
        id: row.dataset.variantId || null,
        variant_name: name,
        mrp: mrp,
        selling_price: price,
        stock: stock,
        is_active: active
      });
    }

    return variants;
  }

  // Remove only a variant explicitly removed from the form.
  function removeVariant(row) {
    const variantId = row.dataset.variantId;

    if (variantId) {
      deletedVariantIds.push(variantId);
    }

    row.remove();

    if (!$("adminVariantsTableBody").querySelector(".admin-variant-row")) {
      $("adminVariantsTableBody").innerHTML = `
        <tr id="adminNoVariantsRow">
          <td colspan="6">
            No pack sizes added yet. Click Add Pack Size.
          </td>
        </tr>
      `;
    }
  }

  // -----------------------------
  // SUPABASE VARIANT SAVE
  // -----------------------------

  function isMissingColumnError(error) {
    return error &&
      (
        error.code === "42703" ||
        /column .* does not exist/i.test(error.message || "")
      );
  }

  function getMissingColumn(error, payload) {
    const message = error.message || "";

    const match = message.match(/column ["']?([^"' ]+)["']? does not exist/i);

    if (match && payload[match[1]] !== undefined) {
      return match[1];
    }

    const simpleMatch = message.match(/Could not find the ['"]([^'"]+)['"] column/i);

    if (simpleMatch && payload[simpleMatch[1]] !== undefined) {
      return simpleMatch[1];
    }

    return null;
  }

  async function saveVariantWithSchemaFallback(payload, variantId) {
    let data = { ...payload };

    // If the actual database does not contain an optional field,
    // retry without that field rather than changing the database.
    for (let attempt = 0; attempt < 8; attempt++) {
      let result;

      if (variantId) {
        result = await supabase
          .from("product_variants")
          .update(data)
          .eq("id", variantId);
      } else {
        result = await supabase
          .from("product_variants")
          .insert([data]);
      }

      if (!result.error) return;

      if (!isMissingColumnError(result.error)) {
        throw result.error;
      }

      const missingColumn = getMissingColumn(result.error, data);

      if (!missingColumn) {
        throw result.error;
      }

      delete data[missingColumn];
    }

    throw new Error("Could not match the product variant database columns.");
  }

  async function saveVariants(productId, variants) {
    // Delete variants explicitly removed by the administrator.
    for (const variantId of deletedVariantIds) {
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", variantId)
        .eq("product_id", productId);

      if (error) throw error;
    }

    for (const variant of variants) {
      const payload = {
        product_id: productId,
        variant_name: variant.variant_name,
        weight: variant.variant_name,
        size: variant.variant_name,
        mrp: variant.mrp,
        original_price: variant.mrp,
        selling_price: variant.selling_price,
        sale_price: variant.selling_price,
        price: variant.selling_price,
        stock: variant.stock,
        stock_quantity: variant.stock,
        is_active: variant.is_active,
        active: variant.is_active
      };

      await saveVariantWithSchemaFallback(payload, variant.id);
    }
  }

  // -----------------------------
  // PRODUCT FORM
  // -----------------------------

  function resetProductForm() {
    $("adminProductForm").reset();

    $("adminProductId").value = "";
    $("adminProductActive").checked = true;

    $("saveProductButton").textContent = "Save Product";

    showMessage("adminProductMessage", "", false);
    showMessage("adminVariantMessage", "", false);

    clearVariants();
  }

  async function editProduct(productId) {
    const product = products.find(function (item) {
      return String(item.id) === String(productId);
    });

    if (!product) return;

    $("adminProductId").value = product.id;
    $("adminProductName").value = product.name || "";
    $("adminProductSlug").value = product.slug || "";
    $("adminProductImage").value = product.image_url || "";
    $("adminProductCategory").value = product.category_id || "";
    $("adminProductDescription").value = product.description || "";
    $("adminProductActive").checked = Boolean(product.is_active);

    $("saveProductButton").textContent = "Update Product";

    await loadVariants(product.id);

    $("adminProductForm").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  async function saveProduct(event) {
    event.preventDefault();

    const productId = $("adminProductId").value;

    const productData = {
      name: $("adminProductName").value.trim(),
      slug: $("adminProductSlug").value.trim(),
      image_url: $("adminProductImage").value.trim() || null,
      category_id: $("adminProductCategory").value.trim() || null,
      description: $("adminProductDescription").value.trim() || null,
      is_active: $("adminProductActive").checked
    };

    if (!productData.name || !productData.slug) {
      showMessage(
        "adminProductMessage",
        "Name and slug are required.",
        true
      );
      return;
    }

    let variants;

    try {
      variants = collectVariants();

      if (variants.length === 0) {
        throw new Error("Add at least one pack size before saving the product.");
      }

    } catch (error) {
      showMessage("adminVariantMessage", error.message, true);
      return;
    }

    const button = $("saveProductButton");

    button.disabled = true;
    button.textContent = "Saving...";

    try {
      let savedProductId = productId;

      if (productId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);

        if (error) throw error;

      } else {
        const { data, error } = await supabase
          .from("products")
          .insert([productData])
          .select("id")
          .single();

        if (error) throw error;

        savedProductId = data.id;
      }

      await saveVariants(savedProductId, variants);

      showMessage(
        "adminProductMessage",
        productId
          ? "Product and pack sizes updated successfully."
          : "Product and pack sizes added successfully.",
        false
      );

      resetProductForm();

      await loadProducts();
      await loadStats();

    } catch (error) {
      console.error("Product save error:", error);

      showMessage(
        "adminProductMessage",
        error.message || "Could not save product.",
        true
      );

    } finally {
      button.disabled = false;
      button.textContent = productId ? "Update Product" : "Save Product";
    }
  }

  // -----------------------------
  // B2B ENQUIRIES
  // -----------------------------

  async function loadLeads() {
    const tbody = $("adminLeadsTableBody");

    tbody.innerHTML =
      '<tr><td colspan="6">Loading enquiries...</td></tr>';

    try {
      const { data, error } = await supabase
        .from("b2b_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      $("adminTotalLeads").textContent = (data || []).length;

      if (!data || data.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6">No enquiries found.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(function (lead) {
        return `
          <tr>
            <td>${escapeHTML(lead.name)}</td>
            <td>${escapeHTML(lead.business_name || "-")}</td>
            <td>${escapeHTML(lead.phone)}</td>
            <td>${escapeHTML(lead.requirement)}</td>
            <td>${escapeHTML(lead.quantity || "-")}</td>
            <td>${escapeHTML(lead.status || "new")}</td>
          </tr>
        `;
      }).join("");

    } catch (error) {
      console.error("B2B leads loading error:", error);

      tbody.innerHTML =
        '<tr><td colspan="6">Could not load enquiries.</td></tr>';
    }
  }

  // -----------------------------
  // EVENT BINDING
  // -----------------------------

  function bindEvents() {
    $("adminLoginForm").addEventListener("submit", login);
    $("adminLogoutButton").addEventListener("click", logout);
    $("adminProductForm").addEventListener("submit", saveProduct);

    $("resetProductFormButton").addEventListener("click", resetProductForm);

    $("refreshProductsButton").addEventListener("click", loadProducts);
    $("refreshLeadsButton").addEventListener("click", loadLeads);

    const addVariantButton = $("addProductVariantButton");

    if (addVariantButton) {
      addVariantButton.addEventListener("click", addVariant);
    }

    $("adminVariantsTableBody").addEventListener("click", function (event) {
      const button = event.target.closest(".admin-remove-variant");

      if (!button) return;

      const row = button.closest(".admin-variant-row");

      if (row) removeVariant(row);
    });

    $("adminVariantsTableBody").addEventListener("input", function (event) {
      if (
        event.target.classList.contains("variant-mrp") ||
        event.target.classList.contains("variant-price")
      ) {
        const row = event.target.closest(".admin-variant-row");

        if (row) updateVariantDiscount(row);
      }
    });

    $("adminProductsTableBody").addEventListener("click", function (event) {
      const button = event.target.closest(".admin-edit-product");

      if (!button) return;

      editProduct(button.dataset.id);
    });

    // Automatically generate a slug from the product name.
    $("adminProductName").addEventListener("input", function () {
      if ($("adminProductId").value) return;

      $("adminProductSlug").value = this.value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    });
  }

  // -----------------------------
  // INITIALIZATION
  // -----------------------------

  document.addEventListener("DOMContentLoaded", async function () {
    try {
      bindEvents();

      await initializeSupabase();
      await checkAdminSession();

      supabase.auth.onAuthStateChange(function (event) {
        if (event === "SIGNED_OUT") {
          showLogin();
        }
      });

    } catch (error) {
      console.error("Admin initialization error:", error);

      showMessage(
        "adminLoginMessage",
        "Admin panel could not connect to the database. " +
        (error.message || "Check the connection and try again."),
        true
      );
    }
  });

})();
