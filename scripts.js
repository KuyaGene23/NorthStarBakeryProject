/* North Star Bakery Project - scripts.js
   Touchstone 4: interactivity and client-side data.

   Three things that are covered in this file:
     1. The pre-order list, the site's interactive feature.
     2. Validation for the contact / pre-order form.
     3. The localStorage layer that both of those share.

   Everything is wrapped in one Immediately Invoked Function Expression (IIFE) 
   so the page keeps a clean global scope. */

(function () {
  "use strict";

  /* =============================================================
     DATA
     ============================================================= */

  /* Array 1: every item a customer can add to a pre-order list.
     The id matches the data-product-id attribute on the matching
     <li> in the products.html file, which is how a button finds its item. */
  var PRODUCTS = [
    { id: "signature-loaf",    name: "Signature Loaf",           category: "Breads",   price: "$9 to $12 per loaf" },
    { id: "honey-oat",         name: "Honey Oat Sandwich Bread", category: "Breads",   price: "$6 to $12 per loaf" },
    { id: "brioche-bread",        name: "Brioche Bread",               category: "Breads",   price: "$6 to $12 per loaf" },
    { id: "butter-croissant",  name: "Butter Croissant",         category: "Pastries", price: "$3 to $6 each" },
    { id: "cinnamon-roll",     name: "Cinnamon Roll",            category: "Pastries", price: "$3 to $6 each" },
    { id: "fruit-danish",      name: "Seasonal Fruit Danish",    category: "Pastries", price: "$3 to $6 each" },
    { id: "oatmeal-creme-cookies",   name: "Oatmeal Creme Cookies",          category: "Pastries", price: "$3 to $6 each" },
    { id: "coconut-cake",       name: "Coconut Creme Cake",              category: "Cakes",    price: "$35 to $85" },
    { id: "sheet-cake",        name: "Event Sheet Cake",         category: "Cakes",    price: "$40 to $100" }
  ];

  /* Object 1: the two localStorage keys, named in one place so a
     typo cannot quietly split the data across two different keys. */
  var STORAGE_KEYS = {
    list: "nsb-preorder-list",
    contact: "nsb-contact-details"
  };

  /* Object 2: the numbers the validation rules below compare against.
     Named here instead of buried in the checks as bare numbers. */
  var LIMITS = {
    minNameLength: 2,
    minDetailLength: 10,
    minNoticeHours: 48,
    closedWeekday: 1 // Monday, per the hours table on the contact page
  };

  var MS_PER_HOUR = 60 * 60 * 1000;

  /* =============================================================
     STORAGE HELPERS

     Every read and write goes through these two functions, so the
     try / catch that protects against private-browsing mode only
     has to be written once.
     ============================================================= */

  function readStored(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      // Storage blocked or the value is corrupt. Fall back instead of
      // breaking the page; the feature still works for this visit.
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* --- the pre-order list itself: an array of product ids --- */

  function getSavedIds() {
    var ids = readStored(STORAGE_KEYS.list, []);
    if (!Array.isArray(ids)) return [];
    // Drop anything that is no longer on the menu.
    return ids.filter(findProduct);
  }

  function findProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === id) return PRODUCTS[i];
    }
    return null;
  }

  function getSavedProducts() {
    return getSavedIds().map(findProduct);
  }

  function isSaved(id) {
    return getSavedIds().indexOf(id) !== -1;
  }

  /* Add the item if it is missing, remove it if it's there.
     Returns true when the item ends up on the list. */
  function toggleSaved(id) {
    var ids = getSavedIds();
    var at = ids.indexOf(id);
    var next = at === -1 ? ids.concat([id]) : ids.slice(0, at).concat(ids.slice(at + 1));
    writeStored(STORAGE_KEYS.list, next);
    return next.indexOf(id) !== -1;
  }

  function removeSaved(id) {
    writeStored(STORAGE_KEYS.list, getSavedIds().filter(function (saved) {
      return saved !== id;
    }));
  }

  function clearSaved() {
    writeStored(STORAGE_KEYS.list, []);
  }

  /* =============================================================
     THE COUNT IN THE NAVIGATION

     This runs on all four pages, so the list is visible and doesn't
     get deleted no matter where the customer is. This is what carries
     the selection across page loads.
     ============================================================= */

  function updateNavCount() {
    var link = document.querySelector('.site-nav a[href="products.html"]');
    if (!link) return;

    var count = getSavedIds().length;
    var badge = link.querySelector(".nav-count");

    if (count === 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "nav-count";
      link.appendChild(badge);
    }
    badge.textContent = String(count);
    badge.setAttribute("aria-label", count + " item" + (count === 1 ? "" : "s") + " saved for pre-order");
  }

  /* =============================================================
     FEATURE: THE PRE-ORDER LIST  (products.html)
     ============================================================= */

  function labelFor(saved) {
    return saved ? "★ On your list" : "☆ Add to pre-order list";
  }

  /* Put one toggle button inside every product card on the page. */
  function buildToggleButtons() {
    var cards = document.querySelectorAll("[data-product-id]");

    Array.prototype.forEach.call(cards, function (card) {
      var id = card.getAttribute("data-product-id");
      if (!findProduct(id)) return;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "save-btn";
      button.setAttribute("data-toggle-for", id);
      paintToggle(button, isSaved(id));

      button.addEventListener("click", function () {
        var nowSaved = toggleSaved(id);
        renderList();
        announce(findProduct(id).name + (nowSaved ? " added to your pre-order list." : " removed from your pre-order list."));
      });

      card.appendChild(button);
    });
  }

  function paintToggle(button, saved) {
    button.textContent = labelFor(saved);
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", saved ? "true" : "false");
  }

  /* Re-sync every toggle button with storage. Called after any change
     so a "Remove" click in the panel also un-presses the card button. */
  function refreshToggles() {
    var buttons = document.querySelectorAll("[data-toggle-for]");
    Array.prototype.forEach.call(buttons, function (button) {
      paintToggle(button, isSaved(button.getAttribute("data-toggle-for")));
    });
  }

  function renderList() {
    var status = document.getElementById("list-status");
    var items = document.getElementById("list-items");
    var actions = document.getElementById("list-actions");
    if (!status || !items) return;

    var saved = getSavedProducts();

    items.innerHTML = "";
    saved.forEach(function (product) {
      items.appendChild(buildListRow(product));
    });

    if (saved.length === 0) {
      status.textContent = "Nothing saved yet. Use the “Add to pre-order list” button on any item below and it will stay here, even if you close the page.";
    } else {
      status.textContent = "You have " + saved.length + " item" + (saved.length === 1 ? "" : "s") +
        " saved. Take this list to the pre-order form and it will fill itself in.";
    }

    if (actions) actions.hidden = saved.length === 0;

    refreshToggles();
    updateNavCount();
  }

  function buildListRow(product) {
    var row = document.createElement("li");

    var name = document.createElement("strong");
    name.textContent = product.name;
    row.appendChild(name);

    var detail = document.createElement("span");
    detail.className = "list-detail";
    detail.textContent = product.category + " · " + product.price;
    row.appendChild(detail);

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + product.name + " from your pre-order list");
    remove.addEventListener("click", function () {
      removeSaved(product.id);
      renderList();
      announce(product.name + " removed from your pre-order list.");
    });
    row.appendChild(remove);

    return row;
  }

  function announce(message) {
    var region = document.getElementById("list-announcer");
    if (region) region.textContent = message;
  }

  function initPreOrderList() {
    if (!document.getElementById("list-status")) return;
    buildToggleButtons();
    renderList();

    var clear = document.getElementById("list-clear");
    if (clear) {
      clear.addEventListener("click", function () {
        clearSaved();
        renderList();
        announce("Your pre-order list is now empty.");
      });
    }
  }

  /* =============================================================
     FORM VALIDATION  (contact.html)
     ============================================================= */

  function valueOf(form, name) {
    var field = form.elements[name];
    return field ? String(field.value).trim() : "";
  }

  /* Array 2: one rule per field that gets checked. Each rule returns
     an empty string when the field is fine, or the message to show
     underneath it when it is not. Adding a field means adding a row
     here; nothing else has to change. */
  var VALIDATION_RULES = [
    {
      fieldId: "full-name",
      check: function (value) {
        if (!value) return "Please enter your name so we know who the order is for.";
        if (value.length < LIMITS.minNameLength) {
          return "Please enter at least " + LIMITS.minNameLength + " characters.";
        }
        return "";
      }
    },
    {
      fieldId: "email",
      check: function (value) {
        if (!value) return "Please enter an email address so we can confirm your order.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          return "That address is missing an @ or a domain. Example: name@example.com";
        }
        return "";
      }
    },
    {
      fieldId: "request-type",
      check: function (value) {
        if (!value) return "Please choose what kind of request this is.";
        return "";
      }
    },
    {
      fieldId: "pickup-date",
      check: function (value, form) {
        var type = valueOf(form, "request_type");
        var needsDate = type === "pre-order" || type === "event";

        if (!value) {
          return needsDate ? "A pickup date is required for this kind of request." : "";
        }
        var pickup = new Date(value + "T09:00:00");
        if (isNaN(pickup.getTime())) return "Please enter the date as YYYY-MM-DD.";

        var hoursAway = (pickup.getTime() - Date.now()) / MS_PER_HOUR;
        if (hoursAway < LIMITS.minNoticeHours) {
          return "We need at least " + LIMITS.minNoticeHours + " hours of notice. Please pick a later date.";
        }
        if (pickup.getDay() === LIMITS.closedWeekday) {
          return "We are closed on Mondays. Please choose another day.";
        }
        return "";
      }
    },
    {
      fieldId: "item-details",
      check: function (value) {
        if (!value) return "Tell us what you would like, or ask your question here.";
        if (value.length < LIMITS.minDetailLength) {
          return "Please add a little more detail (at least " + LIMITS.minDetailLength + " characters).";
        }
        return "";
      }
    }
  ];

  function showError(field, message) {
    var slot = document.getElementById("err-" + field.id);
    if (slot) slot.textContent = message;
    field.classList.toggle("has-error", Boolean(message));
    if (message) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }

  function checkField(form, rule) {
    var field = document.getElementById(rule.fieldId);
    if (!field) return true;
    var message = rule.check(String(field.value).trim(), form);
    showError(field, message);
    return message === "";
  }

  /* Check every rule, then move focus to the first field that failed.
     Nothing the customer typed is cleared. */
  function validateForm(form) {
    var firstBad = null;

    VALIDATION_RULES.forEach(function (rule) {
      if (!checkField(form, rule) && !firstBad) {
        firstBad = document.getElementById(rule.fieldId);
      }
    });

    if (firstBad) {
      firstBad.focus();
      return false;
    }
    return true;
  }

  /* Re-check a field as soon as the customer edits it, but only once it
     has already failed, so nobody is scolded mid-word on a first pass. */
  function watchForCorrections(form) {
    VALIDATION_RULES.forEach(function (rule) {
      var field = document.getElementById(rule.fieldId);
      if (!field) return;

      var events = field.tagName === "SELECT" ? ["change"] : ["input", "change"];
      events.forEach(function (name) {
        field.addEventListener(name, function () {
          if (field.classList.contains("has-error")) checkField(form, rule);
        });
      });
    });
  }

  /* --- remembering the customer between visits --- */

  function rememberContact(form) {
    writeStored(STORAGE_KEYS.contact, {
      fullName: valueOf(form, "full_name"),
      email: valueOf(form, "email"),
      requestType: valueOf(form, "request_type")
    });
  }

  function restoreContact(form) {
    var saved = readStored(STORAGE_KEYS.contact, null);
    if (!saved || typeof saved !== "object") return false;

    var pairs = [
      ["full-name", saved.fullName],
      ["email", saved.email],
      ["request-type", saved.requestType]
    ];

    var filled = false;
    pairs.forEach(function (pair) {
      var field = document.getElementById(pair[0]);
      if (field && !field.value && pair[1]) {
        field.value = pair[1];
        filled = true;
      }
    });
    return filled;
  }

  /* Turn the saved pre-order list into the opening lines of the
     item details box, so the customer does not retype it. */
  function prefillFromList() {
    var details = document.getElementById("item-details");
    if (!details || details.value.trim()) return false;

    var saved = getSavedProducts();
    if (saved.length === 0) return false;

    details.value = "Pre-order list from the products page:\n" +
      saved.map(function (product) {
        return "- " + product.name + " (" + product.price + ") - quantity: ";
      }).join("\n") + "\n";
    return true;
  }

  function showNotice(id, message) {
    var notice = document.getElementById(id);
    if (!notice) return;
    notice.textContent = message;
    notice.hidden = false;
  }

  function initFormValidation() {
    var form = document.getElementById("preorder-form");
    if (!form) return;

    // The browser's own bubbles would fire before ours and land away
    // from the field, so we turn them off and do the checks here.
    form.setAttribute("novalidate", "novalidate");
    watchForCorrections(form);

    var remembered = restoreContact(form);
    var carried = prefillFromList();

    if (remembered) {
      showNotice("restore-notice", "We filled in the details you used last time. Change anything that is out of date.");
    }
    if (carried) {
      showNotice("list-notice", "Your saved pre-order list was added below. Add a quantity next to each item.");
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!validateForm(form)) return;

      rememberContact(form);
      finishSubmission(form);
    });
  }

  function finishSubmission(form) {
    var success = document.getElementById("form-success");
    var name = valueOf(form, "full_name").split(" ")[0];

    clearSaved();
    updateNavCount();
    form.reset();
    restoreContact(form);

    if (!success) return;
    success.textContent = "Thank you, " + name + ". Your request is in. We reply within one " +
      "business day to confirm the details and your pickup time.";
    success.hidden = false;
    success.focus();
  }

  /* =============================================================
     START
     ============================================================= */

  document.addEventListener("DOMContentLoaded", function () {
    updateNavCount();
    initPreOrderList();
    initFormValidation();
  });
})();
