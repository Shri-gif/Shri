(function () {
  "use strict";

  let supabase = null;
  let products = [];
  let currentVariants = [];
  let deletedVariantIds = [];
  let activeProductId = null;

  const $ = id => document.getElementById(id);

  function showMessage(id, message, isError) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#c62828" : "#287a3d";
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character]));
  }

  function getVariantName(v) {
    return v.variant_name || v.weight || v.size || v.name || v.quantity || "";
  }

  function getVariantPrice(v) {
    return v.selling_price ?? v.sale_price ?? v.price ?? 0;
  }

  function getVariantStock(v) {
    return v.stock ?? v.stock_quantity ?? v.quantity_available ?? 0;
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

  // -------------------------
  // AUTHENTICATION
  // -------------------------

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
        email,
        password
      });

      if (error) throw error;

      await checkAdminSession();

    } catch (error) {
      console.error(error);
      showMessage("adminLoginMessage", error.message, true);
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
      resetProductForm();

    } catch (error) {
      console.error(error);
      alert("Could not log out. Please try again.");
    }
  }

  // -------------------------
  // DASHBOARD
  // -------------------------

  async function loadDashboard() {
    await Promise.all([
      loadProducts(),
      loadStats(),
      loadLeads()
    ]);
  }

  async function loadStats() {
    try {
      const [p, o, l] = await Promise.all([
        supabase.from("products")
          .select("id", { count: "exact", head: true }),

        supabase.from("orders")
          .select("id", { count: "exact", head: true }),

        supabase.from("b2b_leads")
          .select("id", { count: "exact", head: true })
      ]);

      if (p.error) throw p.error;
      if (o.error) throw o.error;
      if (l.error) throw l.error;

      $("adminTotalProducts").textContent = p.count ?? 0;
      $("adminTotalOrders").textContent = o.count ?? 0;
      $("adminTotalLeads").textContent = l.count ?? 0;

    } catch (error) {
      console.error("Stats error:", error);
    }
  }

  // -------------------------
  // PRODUCT + VARIANT LIST
  // -------------------------

  async function loadProducts() {
    const tbody = $("adminProductsTableBody");

    tbody.innerHTML = '<tr><td colspan="8">Loading products...</td></tr>';

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      products = data || [];

      await renderProductsTable();

    } catch (error) {
      console.error(error);
      tbody.innerHTML =
        '<tr><td colspan="8">Could not load products.</td></tr>';
    }
  }

  async function renderProductsTable() {
    const tbody = $("adminProductsTableBody");

    const table = tbody.closest("table");

    if (table) {
      const thead = table.querySelector("thead");

      if (thead) {
        thead.innerHTML = `
          <tr>
            <th>Product</th>
            <th>Slug</th>
            <th>Pack Size</th>
            <th>MRP</th>
            <th>Selling Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        `;
      }
    }

    if (!products.length) {
      tbody.innerHTML =
        '<tr><td colspan="8">No products found.</td></tr>';

      $("adminTotalProducts").textContent = 0;
      return;
    }

    tbody.innerHTML =
      '<tr><td colspan="8">Loading pack sizes...</td></tr>';

    const { data: variants, error } = await supabase
      .from("product_variants")
      .select("*");

    if (error) throw error;

    const allVariants = variants || [];

    let html = "";

    products.forEach(product => {
      const productVariants = allVariants.filter(v =>
        String(v.product_id) === String(product.id)
      );

      const status = product.is_active ? "Active" : "Inactive";

      if (!productVariants.length) {
        html += `
          <tr>
            <td>${escapeHTML(product.name)}</td>
            <td>${escapeHTML(product.slug)}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
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

        return;
      }

      productVariants.forEach((variant, index) => {
        html += `
          <tr>
            <td>
              ${index === 0
                ? escapeHTML(product.name)
                : '<span style="opacity:.45">↳</span>'}
            </td>

            <td>
              ${index === 0
                ? escapeHTML(product.slug)
                : ""}
            </td>

            <td>${escapeHTML(getVariantName(variant))}</td>

            <td>₹${escapeHTML(variant.mrp ?? variant.original_price ?? "-")}</td>

            <td>₹${escapeHTML(getVariantPrice(variant))}</td>

            <td>${escapeHTML(getVariantStock(variant))}</td>

            <td>
              ${index === 0 ? status : ""}
            </td>

            <td>
              ${index === 0 ? `
                <button
                  type="button"
                  class="btn btn-secondary admin-edit-product"
                  data-id="${escapeHTML(product.id)}">
                  Edit
                </button>
              ` : ""}
            </td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = html;

    $("adminTotalProducts").textContent = products.length;
  }

  // -------------------------
  // VARIANT EDITOR
  // -------------------------

  function renderVariantRow(variant) {
    const tbody = $("adminVariantsTableBody");
    if (!tbody) return;

    const noRow = $("adminNoVariantsRow");
    if (noRow) noRow.remove();

    const row = document.createElement("tr");
    row.className = "admin-variant-row";
    row.dataset.variantId = variant.id || "";

    row.innerHTML = `
      <td>
        <input
          class="variant-name"
          type="text"
          value="${escapeHTML(getVariantName(variant))}"
          placeholder="100g / 200g / 1kg"
          required>
      </td>

      <td>
        <input
          class="variant-mrp"
          type="number"
          value="${escapeHTML(variant.mrp ?? variant.original_price ?? "")}"
          min="0"
          step="0.01"
          required>
      </td>

      <td>
        <input
          class="variant-price"
          type="number"
          value="${escapeHTML(getVariantPrice(variant))}"
          min="0"
          step="0.01"
          required>
        <small class="variant-discount"></small>
      </td>

      <td>
        <input
          class="variant-stock"
          type="number"
          value="${escapeHTML(getVariantStock(variant))}"
          min="0"
          step="1"
          required>
      </td>

      <td>
        <input
          class="variant-active"
          type="checkbox"
          ${variant.is_active !== false && variant.active !== false ? "checked" : ""}>
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
    const productName = $("adminProductName").value.trim();

    if (!productName) {
      showMessage(
        "adminVariantMessage",
        "Enter product name first.",
        true
      );
      return;
    }

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
        <td colspan="6">No pack sizes added yet.</td>
      </tr>
    `;

    currentVariants = [];
    deletedVariantIds = [];
  }

  async function loadVariants(productId) {
    clearVariants();

    activeProductId = String(productId);

    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId);

    if (error) throw error;

    currentVariants = data || [];

    if (!currentVariants.length) return;

    $("adminVariantsTableBody").innerHTML = "";

    currentVariants.forEach(renderVariantRow);
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

      if (!name) throw new Error("Enter a pack size.");

      if (!Number.isFinite(mrp) || mrp <= 0) {
        throw new Error("Invalid MRP for " + name);
      }

      if (!Number.isFinite(price) || price <= 0 || price > mrp) {
        throw new Error("Invalid selling price for " + name);
      }

      if (!Number.isInteger(stock) || stock < 0) {
        throw new Error("Invalid stock for " + name);
      }

      variants.push({
        id: row.dataset.variantId || null,
        variant_name: name,
        mrp,
        selling_price: price,
        stock,
        is_active: active
      });
    }

    return variants;
  }

  function removeVariant(row) {
    const id = row.dataset.variantId;

    if (id) deletedVariantIds.push(id);

    row.remove();

    if (!$("adminVariantsTableBody").querySelector(".admin-variant-row")) {
      $("adminVariantsTableBody").innerHTML = `
        <tr id="adminNoVariantsRow">
          <td colspan="6">No pack sizes added yet.</td>
        </tr>
      `;
    }
  }

  // -------------------------
  // SAVE VARIANTS
  // -------------------------

  async function saveVariants(productId, variants) {
    if (!productId) {
      throw new Error("Missing product ID.");
    }

    for (const id of deletedVariantIds) {
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", id)
        .eq("product_id", productId);

      if (error) throw error;
    }

    for (const variant of variants) {
      const payload = {
        product_id: productId,
        variant_name: variant.variant_name,
        mrp: variant.mrp,
        selling_price: variant.selling_price,
        stock: variant.stock,
        is_active: variant.is_active
      };

      if (variant.id) {
        const { error } = await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", variant.id)
          .eq("product_id", productId);

        if (error) throw error;

      } else {
        const { error } = await supabase
          .from("product_variants")
          .insert([payload]);

        if (error) throw error;
      }
    }

    deletedVariantIds = [];
  }

  // -------------------------
  // PRODUCT FORM
  // -------------------------

  function resetProductForm() {
    $("adminProductForm").reset();

    $("adminProductId").value = "";
    $("adminProductActive").checked = true;

    activeProductId = null;

    $("saveProductButton").textContent = "Save Product";

    showMessage("adminProductMessage", "", false);
    showMessage("adminVariantMessage", "", false);

    clearVariants();
  }

  async function editProduct(productId) {
    const product = products.find(p =>
      String(p.id) === String(productId)
    );

    if (!product) return;

    clearVariants();

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

      if (!variants.length) {
        throw new Error("Add at least one pack size.");
      }

    } catch (error) {
      showMessage("adminVariantMessage", error.message, true);
      return;
    }

    const button = $("saveProductButton");
    const originalText = productId ? "Update Product" : "Save Product";

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
        "Product and pack sizes saved successfully.",
        false
      );

      resetProductForm();

      await loadProducts();
      await loadStats();

    } catch (error) {
      console.error(error);

      showMessage(
        "adminProductMessage",
        error.message || "Could not save product.",
        true
      );

    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // -------------------------
  // B2B
  // -------------------------

  async function loadLeads() {
    const tbody = $("adminLeadsTableBody");

    tbody.innerHTML = '<tr><td colspan="6">Loading enquiries...</td></tr>';

    try {
      const { data, error } = await supabase
        .from("b2b_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      $("adminTotalLeads").textContent = (data || []).length;

      if (!data || !data.length) {
        tbody.innerHTML =
          '<tr><td colspan="6">No enquiries found.</td></tr>';
        return;
      }

      tbody.innerHTML = data.map(lead => `
        <tr>
          <td>${escapeHTML(lead.name)}</td>
          <td>${escapeHTML(lead.business_name || "-")}</td>
          <td>${escapeHTML(lead.phone)}</td>
          <td>${escapeHTML(lead.requirement)}</td>
          <td>${escapeHTML(lead.quantity || "-")}</td>
          <td>${escapeHTML(lead.status || "new")}</td>
        </tr>
      `).join("");

    } catch (error) {
      console.error(error);

      tbody.innerHTML =
        '<tr><td colspan="6">Could not load enquiries.</td></tr>';
    }
  }

  // -------------------------
  // EVENTS
  // -------------------------

  function bindEvents() {
    $("adminLoginForm").addEventListener("submit", login);
    $("adminLogoutButton").addEventListener("click", logout);
    $("adminProductForm").addEventListener("submit", saveProduct);

    $("resetProductFormButton").addEventListener("click", resetProductForm);

    $("refreshProductsButton").addEventListener("click", loadProducts);
    $("refreshLeadsButton").addEventListener("click", loadLeads);

    $("addProductVariantButton").addEventListener("click", addVariant);

    $("adminVariantsTableBody").addEventListener("click", event => {
      const button = event.target.closest(".admin-remove-variant");

      if (button) {
        const row = button.closest(".admin-variant-row");
        if (row) removeVariant(row);
      }
    });

    $("adminVariantsTableBody").addEventListener("input", event => {
      if (
        event.target.classList.contains("variant-mrp") ||
        event.target.classList.contains("variant-price")
      ) {
        updateVariantDiscount(
          event.target.closest(".admin-variant-row")
        );
      }
    });

    $("adminProductsTableBody").addEventListener("click", event => {
      const button = event.target.closest(".admin-edit-product");

      if (button) editProduct(button.dataset.id);
    });

    $("adminProductName").addEventListener("input", function () {
      if (!$("adminProductId").value) {
        $("adminProductSlug").value = this.value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
    });
  }

  // -------------------------
  // INIT
  // -------------------------

  document.addEventListener("DOMContentLoaded", async function () {
    try {
      bindEvents();

      await initializeSupabase();
      await checkAdminSession();

      supabase.auth.onAuthStateChange(function (event) {
        if (event === "SIGNED_OUT") showLogin();
      });

    } catch (error) {
      console.error(error);

      showMessage(
        "adminLoginMessage",
        "Admin panel could not connect to the database. " +
        (error.message || "Check the connection."),
        true
      );
    }
  });

})();
