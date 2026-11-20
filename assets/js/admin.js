(function () {
  "use strict";

  let supabase = null;
  let products = [];

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
      .select("id, role")
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
      const [productsResult, ordersResult, leadsResult] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("b2b_leads").select("id", { count: "exact", head: true })
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
    tbody.innerHTML = '<tr><td colspan="4">Loading products...</td></tr>';

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      products = data || [];

      $("adminTotalProducts").textContent = products.length;

      if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No products found.</td></tr>';
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
      tbody.innerHTML = '<tr><td colspan="4">Could not load products.</td></tr>';
    }
  }

  function resetProductForm() {
    $("adminProductForm").reset();
    $("adminProductId").value = "";
    $("adminProductActive").checked = true;
    $("saveProductButton").textContent = "Save Product";
    showMessage("adminProductMessage", "", false);
  }

  function editProduct(productId) {
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
      showMessage("adminProductMessage", "Name and slug are required.", true);
      return;
    }

    const button = $("saveProductButton");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      let result;

      if (productId) {
        result = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);
      } else {
        result = await supabase
          .from("products")
          .insert([productData]);
      }

      if (result.error) throw result.error;

      showMessage(
        "adminProductMessage",
        productId ? "Product updated successfully." : "Product added successfully.",
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

      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No enquiries found.</td></tr>';
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
      tbody.innerHTML = '<tr><td colspan="6">Could not load enquiries.</td></tr>';
    }
  }

  function bindEvents() {
    $("adminLoginForm").addEventListener("submit", login);
    $("adminLogoutButton").addEventListener("click", logout);
    $("adminProductForm").addEventListener("submit", saveProduct);

    $("resetProductFormButton").addEventListener("click", resetProductForm);

    $("refreshProductsButton").addEventListener("click", loadProducts);
    $("refreshLeadsButton").addEventListener("click", loadLeads);

    $("adminProductsTableBody").addEventListener("click", function (event) {
      const button = event.target.closest(".admin-edit-product");
      if (!button) return;

      editProduct(button.dataset.id);
    });
  }

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
        "Admin panel could not connect to the database. Check the connection and try again.",
        true
      );
    }
  });

})();
