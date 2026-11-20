(function () {
  "use strict";

  const CONFIG = window.SHRI_CONFIG || {};

  const WHATSAPP_NUMBER = String(
    CONFIG.whatsappNumber || "917379969545"
  ).replace(/\D/g, "");

  function showMessage(element, message, isError) {
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#c62828" : "#287a3d";
  }

  function getFormValue(form, fieldName) {
    const field = form.elements.namedItem(fieldName);
    return field ? String(field.value || "").trim() : "";
  }

  async function submitB2BLead(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const messageElement = document.getElementById("b2bMessage");
    const submitButton = form.querySelector('button[type="submit"]');

    const name = getFormValue(form, "name");
    const businessName = getFormValue(form, "businessName");
    const phone = getFormValue(form, "phone");
    const email = getFormValue(form, "email");
    const requirement = getFormValue(form, "requirement");
    const quantity = getFormValue(form, "quantity");

    if (!name || !phone || !requirement) {
      showMessage(
        messageElement,
        "Please fill in your name, phone number and requirement.",
        true
      );
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      showMessage(
        messageElement,
        "Please enter a valid phone number.",
        true
      );
      return;
    }

    const lead = {
      name: name,
      business_name: businessName || null,
      phone: phone,
      email: email || null,
      requirement: requirement,
      quantity: quantity || null,
      status: "new"
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      if (!window.shriSupabaseReady) {
        throw new Error("Supabase is not initialized.");
      }

      await window.shriSupabaseReady;

      if (!window.shriSupabase) {
        throw new Error("Database connection is unavailable.");
      }

      const { error } = await window.shriSupabase
        .from("b2b_leads")
        .insert([lead]);

      if (error) {
        throw error;
      }

      showMessage(
        messageElement,
        "Thank you! Your wholesale enquiry has been submitted successfully.",
        false
      );

      form.reset();

    } catch (error) {
      console.error("B2B enquiry submission error:", error);

      showMessage(
        messageElement,
        "Enquiry could not be submitted right now. Please contact us on WhatsApp.",
        true
      );

      if (WHATSAPP_NUMBER) {
        const whatsappMessage =
          "Namaste Shri Spices!\n\n" +
          "I want to enquire about wholesale supply.\n\n" +
          "Name: " + name + "\n" +
          "Business: " + (businessName || "Not provided") + "\n" +
          "Phone: " + phone + "\n" +
          "Email: " + (email || "Not provided") + "\n" +
          "Requirement: " + requirement + "\n" +
          "Quantity: " + (quantity || "Not provided");

        const whatsappUrl =
          "https://wa.me/" +
          WHATSAPP_NUMBER +
          "?text=" +
          encodeURIComponent(whatsappMessage);

        const link = document.createElement("a");
        link.href = whatsappUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Contact us on WhatsApp";
        link.style.display = "inline-block";
        link.style.marginTop = "8px";

        messageElement.appendChild(document.createElement("br"));
        messageElement.appendChild(link);
      }

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Enquiry";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("b2bForm");

    if (form) {
      form.addEventListener("submit", submitB2BLead);
    }
  });

  window.ShriB2B = {
    submit: submitB2BLead
  };

})();
