(function () {
  "use strict";

  let supabase = null;
  let products = [];
  let currentVariants = [];
  let deletedVariantIds = [];

  const $ = id => document.getElementById(id);

  function showMessage(id, message, isError = false) {
    const element = $(id);
    if (!element) return;
    element.textContent = message || "";
    element.style.color = isError ? "#c62828" : "#287a3d";
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : "0.00";
  }

  function initializeSupabase() {
    return (async () => {
      if (window.shriSupabaseReady) await window.shriSupabaseReady;
      if (!window.shriSupabase) throw new Error("Supabase connection is unavailable.");
      supabase = window.shriSupabase;
    })();
  }

  async function checkAdminSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (!data.session) {
      showLogin();
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id, role")
      .eq("user_id", data.session.user.id)
      .maybeSingle();

    if (adminError) throw adminError;

    if (!admin) {
      await supabase.auth.signOut();
      showLogin();
      showMessage("adminLoginMessage", "This account is not authorized as an administrator.", true);
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await checkAdminSession();
    } catch (error) {
      console.error("Admin login error:", error);
      showMessage("adminLoginMessage", error.message || "Login failed. Please try again.", true);
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
    await Promise.all([loadProducts(), loadStats(), loadLeads()]);
  }

  async function loadStats() {
    try {
      const [p, o, l] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("b2b_leads").select("id", { count: "exact", head: true })
      ]);
      if (p.error) throw p.error;
      if (o.error) throw o.error;
      if (l.error) throw l.error;
      $("adminTotalProducts").textContent = p.count ?? 0;
      $("adminTotalOrders").textContent = o.count ?? 0;
      $("adminTotalLeads").textContent = l.count ?? 0;
    } catch (error) {
      console.error("Dashboard stats error:", error);
    }
  }

  async function fetchVariants(productIds) {
    if (!productIds.length) return [];
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .in("product_id", productIds);
    if (error) throw error;
    return data || [];
  }

  function variantLabel(variant) {
    return variant.weight ?? variant.variant_name ?? variant.name ?? variant.size ?? variant.quantity ?? "Standard";
  }

  function variantPrice(variant) {
    return Number(variant.price ?? variant.selling_price ?? variant.sale_price ?? 0);
  }

  function variantMrp(variant) {
    return Number(variant.mrp ?? variant.original_price ?? variant.price ?? 0);
  }

  function variantStock(variant) {
    return Number(variant.stock ?? variant.stock_quantity ?? variant.quantity_available ?? 0);
  }

  async function loadProducts() {
    const tbody = $("adminProductsTableBody");
    tbody.innerHTML = '<tr><td colspan="7">Loading products...</td></tr>';

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      products = data || [];
      $("adminTotalProducts").textContent = products.length;

      const variants = await fetchVariants(products.map(product => product.id));
      if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="7">No products found.</td></tr>';
        return;
      }

      tbody.innerHTML = products.map(product => {
        const ownVariants = variants.filter(v => String(v.product_id) === String(product.id));
        if (!ownVariants.length) {
          return `<tr>
            <td>${escapeHTML(product.name)}</td><td colspan="4">No pack sizes</td>
            <td>${product.is_active ? "Active" : "Inactive"}</td>
            <td><button type="button" class="btn btn-secondary admin-edit-product" data-id="${escapeHTML(product.id)}">Edit</button></td>
          </tr>`;
        }
        return ownVariants.map((variant, index) => `<tr>
          <td>${index === 0 ? escapeHTML(product.name) : `<span class="admin-muted">${escapeHTML(product.name)} (same product)</span>`}</td>
          <td>${escapeHTML(variantLabel(variant))}</td>
          <td>₹${money(variantMrp(variant))}</td>
          <td>₹${money(variantPrice(variant))}</td>
          <td>${escapeHTML(variantStock(variant))}</td>
          <td>${product.is_active && (variant.is_active ?? variant.active ?? true) ? "Active" : "Inactive"}</td>
          <td>${index === 0 ? `<button type="button" class="btn btn-secondary admin-edit-product" data-id="${escapeHTML(product.id)}">Edit</button>` : ""}</td>
        </tr>`).join("");
      }).join("");
    } catch (error) {
      console.error("Products loading error:", error);
      tbody.innerHTML = '<tr><td colspan="7">Could not load products. Check products/product_variants permissions and columns.</td></tr>';
    }
  }

  function renderVariantRows() {
    const tbody = $("adminVariantsTableBody");
    if (!currentVariants.length) {
      tbody.innerHTML = '<tr id="adminNoVariantsRow"><td colspan="6">No pack sizes added yet. Use “Add Pack Size”.</td></tr>';
      return;
    }

    tbody.innerHTML = currentVariants.map((variant, index) => `
      <tr data-variant-index="${index}">
        <td><input type="text" class="variant-weight" value="${escapeHTML(variant.weight ?? "")}" placeholder="e.g. 100g" required></td>
        <td><input type="number" class="variant-mrp" min="0" step="0.01" value="${escapeHTML(variant.mrp ?? "")}" placeholder="0.00"></td>
        <td><input type="number" class="variant-price" min="0" step="0.01" value="${escapeHTML(variant.price ?? "")}" placeholder="0.00" required></td>
        <td><input type="number" class="variant-stock" min="0" step="1" value="${escapeHTML(variant.stock ?? 0)}" required></td>
        <td><input type="checkbox" class="variant-active" ${variant.is_active !== false ? "checked" : ""} aria-label="Pack size active"></td>
        <td><button type="button" class="btn btn-secondary admin-remove-variant" data-index="${index}">Remove</button></td>
      </tr>
    `).join("");
  }

  function addVariant() {
    currentVariants.push({
      id: null, product_id: $("adminProductId").value || null,
      weight: "", mrp: "", price: "", stock: 0, is_active: true
    });
    renderVariantRows();
  }

  function collectVariantsFromForm() {
    const rows = [...$("adminVariantsTableBody").querySelectorAll("tr[data-variant-index]")];
    return rows.map(row => {
      const index = Number(row.dataset.variantIndex);
      const previous = currentVariants[index] || {};
      return {
        ...previous,
        weight: row.querySelector(".variant-weight").value.trim(),
        mrp: row.querySelector(".variant-mrp").value === "" ? null : Number(row.querySelector(".variant-mrp").value),
        price: Number(row.querySelector(".variant-price").value),
        stock: Number(row.querySelector(".variant-stock").value),
        is_active: row.querySelector(".variant-active").checked
      };
    });
  }

  function resetProductForm() {
    $("adminProductForm").reset();
    $("adminProductId").value = "";
    $("adminProductActive").checked = true;
    currentVariants = [];
    deletedVariantIds = [];
    renderVariantRows();
    $("saveProductButton").textContent = "Save Product";
    showMessage("adminProductMessage", "");
    showMessage("adminVariantMessage", "");
  }

  async function editProduct(productId) {
    const product = products.find(item => String(item.id) === String(productId));
    if (!product) return;

    try {
      const variants = await fetchVariants([product.id]);
      $("adminProductId").value = product.id;
      $("adminProductName").value = product.name || "";
      $("adminProductSlug").value = product.slug || "";
      $("adminProductImage").value = product.image_url || "";
      $("adminProductCategory").value = product.category_id || "";
      $("adminProductDescription").value = product.description || "";
      $("adminProductActive").checked = Boolean(product.is_active);
      currentVariants = variants.map(v => ({ ...v }));
      deletedVariantIds = [];
      renderVariantRows();
      $("saveProductButton").textContent = "Update Product";
      $("adminProductForm").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error("Variant loading error:", error);
      showMessage("adminProductMessage", "Could not load this product's pack sizes: " + error.message, true);
    }
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
      showMessage("adminProductMessage", "Name and slug are required.", true);
      return;
    }

    const variants = collectVariantsFromForm();
    if (!variants.length) {
      showMessage("adminVariantMessage", "Add at least one pack size before saving.", true);
      return;
    }

    for (const v of variants) {
      if (!v.weight || !Number.isFinite(v.price) || v.price < 0 ||
          !Number.isFinite(v.stock) || v.stock < 0 ||
          (v.mrp !== null && (!Number.isFinite(v.mrp) || v.mrp < 0))) {
        showMessage("adminVariantMessage", "Check pack size, MRP, selling price and stock values.", true);
        return;
      }
    }

    const button = $("saveProductButton");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      let savedProductId = productId;

      if (productId) {
        const { error } = await supabase.from("products").update(productData).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert([productData]).select("id").single();
        if (error) throw error;
        savedProductId = data.id;
      }

      // Remove only variants explicitly removed while editing this product.
      if (deletedVariantIds.length) {
        const { error } = await supabase.from("product_variants").delete()
          .in("id", deletedVariantIds).eq("product_id", savedProductId);
        if (error) throw error;
      }

      for (const variant of variants) {
        const payload = {
          product_id: savedProductId,
          weight: variant.weight,
          mrp: variant.mrp,
          price: variant.price,
          stock: variant.stock,
          is_active: variant.is_active
        };

        let result;
        if (variant.id) {
          result = await supabase.from("product_variants").update(payload)
            .eq("id", variant.id).eq("product_id", savedProductId);
        } else {
          result = await supabase.from("product_variants").insert([payload]);
        }
        if (result.error) throw result.error;
      }

      showMessage("adminProductMessage", productId ? "Product and pack sizes updated successfully." : "Product and pack sizes saved successfully.");
      resetProductForm();
      await Promise.all([loadProducts(), loadStats()]);
    } catch (error) {
      console.error("Product save error:", error);
      showMessage("adminProductMessage", error.message || "Could not save product and pack sizes.", true);
    } finally {
      button.disabled = false;
      button.textContent = $("adminProductId").value ? "Update Product" : "Save Product";
    }
  }

  async function loadLeads() {
    const tbody = $("adminLeadsTableBody");
    tbody.innerHTML = '<tr><td colspan="6">Loading enquiries...</td></tr>';
    try {
      const { data, error } = await supabase.from("b2b_leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      $("adminTotalLeads").textContent = (data || []).length;
      if (!data || !data.length) {
        tbody.innerHTML = '<tr><td colspan="6">No enquiries found.</td></tr>';
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
      console.error("B2B leads loading error:", error);
      tbody.innerHTML = '<tr><td colspan="6">Could not load enquiries.</td></tr>';
    }
  }

  function bindEvents() {
    $("adminLoginForm").addEventListener("submit", login);
    $("adminLogoutButton").addEventListener("click", logout);
    $("adminProductForm").addEventListener("submit", saveProduct);
    $("resetProductFormButton").addEventListener("click", resetProductForm);
    $("addProductVariantButton").addEventListener("click", addVariant);
    $("refreshProductsButton").addEventListener("click", loadProducts);
    $("refreshLeadsButton").addEventListener("click", loadLeads);

    $("adminVariantsTableBody").addEventListener("click", event => {
      const button = event.target.closest(".admin-remove-variant");
      if (!button) return;
      const index = Number(button.dataset.index);
      const removed = currentVariants[index];
      if (removed && removed.id) deletedVariantIds.push(removed.id);
      currentVariants.splice(index, 1);
      renderVariantRows();
    });

    $("adminProductsTableBody").addEventListener("click", event => {
      const button = event.target.closest(".admin-edit-product");
      if (button) editProduct(button.dataset.id);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      bindEvents();
      renderVariantRows();
      await initializeSupabase();
      await checkAdminSession();
      supabase.auth.onAuthStateChange(event => {
        if (event === "SIGNED_OUT") showLogin();
      });
    } catch (error) {
      console.error("Admin initialization error:", error);
      showMessage("adminLoginMessage", error.message || "Admin panel could not connect to the database.", true);
    }
  });
})();
