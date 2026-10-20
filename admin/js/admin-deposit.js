
"use strict";

/*
 * KUDIX — Level Up Payment Configuration
 *
 * Required backend endpoints:
 *
 * GET  /api/admin/settings/level-up-payment
 * POST /api/admin/settings/level-up-payment
 *
 * GET response example:
 * {
 *   "paymentMethod": "paystack",
 *   "publicKey": "pk_test_example",
 *   "secretKeyConfigured": true
 * }
 *
 * POST request example:
 * {
 *   "paymentMethod": "paystack",
 *   "publicKey": "pk_test_example",
 *   "secretKey": "sk_test_example"
 * }
 *
 * The backend must:
 * - Require an authenticated administrator.
 * - Validate the keys and provider.
 * - Store the secret securely on the server.
 * - Never return the secret key.
 * - Never log credentials.
 *
 * Leave API_BASE_URL empty for a same-origin backend.
 */

const LEVEL_UP_CONFIG = {
    API_BASE_URL: "",
    SETTINGS_ENDPOINT: "/api/admin/settings/level-up-payment",
    REQUEST_TIMEOUT: 15000
};

document.addEventListener("DOMContentLoaded", () => {
    initializeSidebar();
    initializePasswordToggle();
    initializePaymentSettings();
});

/* =========================================
   MOBILE SIDEBAR
========================================= */

function initializeSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const openButton = document.getElementById("openSidebar");
    const closeButton = document.getElementById("closeSidebar");

    if (!sidebar || !overlay || !openButton || !closeButton) {
        return;
    }

    function openSidebar() {
        sidebar.classList.add("sidebar-open");
        overlay.classList.add("overlay-open");
        openButton.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        closeButton.focus();
    }

    function closeSidebar() {
        sidebar.classList.remove("sidebar-open");
        overlay.classList.remove("overlay-open");
        openButton.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";

        if (window.innerWidth <= 760) {
            openButton.focus();
        }
    }

    openButton.addEventListener("click", openSidebar);
    closeButton.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 760) {
                closeSidebar();
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            sidebar.classList.contains("sidebar-open")
        ) {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 760) {
            sidebar.classList.remove("sidebar-open");
            overlay.classList.remove("overlay-open");
            openButton.setAttribute("aria-expanded", "false");
            document.body.style.overflow = "";
        }
    });
}

/* =========================================
   SHOW / HIDE SECRET KEY
========================================= */

function initializePasswordToggle() {
    document.querySelectorAll(".password-toggle").forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.target;
            const input = document.getElementById(targetId);

            if (!input) {
                return;
            }

            const shouldShow = input.type === "password";

            input.type = shouldShow ? "text" : "password";
            button.setAttribute("aria-pressed", String(shouldShow));
            button.setAttribute(
                "aria-label",
                shouldShow ? "Hide secret key" : "Show secret key"
            );

            const icon = button.querySelector("i");

            if (icon) {
                icon.className = shouldShow ? "bx bx-hide" : "bx bx-show";
            }
        });
    });
}

/* =========================================
   PAYMENT SETTINGS
========================================= */

function initializePaymentSettings() {
    const form = document.getElementById("paymentSettingsForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        await savePaymentSettings();
    });

    // Load only non-secret configuration and secret-key status.
    loadPaymentSettings();
}

/* =========================================
   LOAD CURRENT SETTINGS
========================================= */

async function loadPaymentSettings() {
    try {
        const response = await apiRequest("GET");

        if (!response.ok) {
            if (response.status === 404) {
                showMessage(
                    "Payment settings are not available yet. Configure the backend endpoint before saving settings.",
                    "info"
                );
                return;
            }

            if (response.status === 401 || response.status === 403) {
                showMessage(
                    "Administrator authentication is required to view payment settings.",
                    "error"
                );
                return;
            }

            throw new Error("Unable to load payment settings.");
        }

        const data = await readJsonResponse(response);

        if (data.paymentMethod && data.paymentMethod !== "paystack") {
            showMessage(
                "The server returned an unsupported payment provider.",
                "error"
            );
            return;
        }

        const publicKeyInput = document.getElementById("publicKey");
        const paymentMethod = document.getElementById("paymentMethod");
        const secretInput = document.getElementById("secretKey");
        const configuredNotice = document.getElementById("secretConfigured");

        paymentMethod.value = "paystack";

        if (typeof data.publicKey === "string") {
            publicKeyInput.value = data.publicKey;
        }

        // Never place a stored secret key in the browser.
        secretInput.value = "";

        configuredNotice.hidden = data.secretKeyConfigured !== true;

        hideMessage();

    } catch (error) {
        // Avoid exposing technical details or credentials in the UI.
        showMessage(
            error.message ||
            "Could not connect to the payment settings service.",
            "error"
        );
    }
}

/* =========================================
   SAVE SETTINGS
========================================= */

async function savePaymentSettings() {
    const methodInput = document.getElementById("paymentMethod");
    const secretInput = document.getElementById("secretKey");
    const publicInput = document.getElementById("publicKey");
    const configuredNotice = document.getElementById("secretConfigured");

    const paymentMethod = methodInput.value;
    const secretKey = secretInput.value.trim();
    const publicKey = publicInput.value.trim();

    if (paymentMethod !== "paystack") {
        showMessage("Please select Paystack as the payment method.", "error");
        return;
    }

    if (!publicKey) {
        showMessage("Please enter your Paystack public key.", "error");
        publicInput.focus();
        return;
    }

    if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(publicKey)) {
        showMessage(
            "Enter a valid Paystack public key beginning with pk_test_ or pk_live_.",
            "error"
        );
        publicInput.focus();
        return;
    }

    if (secretKey && !/^sk_(test|live)_[A-Za-z0-9]+$/.test(secretKey)) {
        showMessage(
            "Check your Paystack secret key. It should begin with sk_test_ or sk_live_.",
            "error"
        );
        secretInput.focus();
        return;
    }

    if (!secretKey && configuredNotice.hidden) {
        showMessage(
            "Enter your Paystack secret key to configure the payment provider for the first time.",
            "error"
        );
        secretInput.focus();
        return;
    }

    const button = document.getElementById("saveSettingsButton");
    const buttonText = document.getElementById("saveButtonText");
    const buttonIcon = document.getElementById("saveButtonIcon");

    if (button.disabled) {
        return;
    }

    setSaving(true);
    buttonText.textContent = "Saving Settings...";
    buttonIcon.className = "bx bx-loader-alt is-loading";

    showMessage("Submitting payment settings securely...", "info");

    const payload = {
        paymentMethod,
        publicKey
    };

    // Blank secret key means retain the existing key on the server.
    if (secretKey) {
        payload.secretKey = secretKey;
    }

    try {
        const response = await apiRequest("POST", payload);

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                "You are not authorized to update payment settings."
            );
        }

        if (!response.ok) {
            if (response.status >= 500) {
                throw new Error(
                    "The server could not save your settings. Please try again later."
                );
            }

            const errorData = await tryReadError(response);

            throw new Error(
                errorData.message ||
                "Payment settings could not be saved. Check your entries."
            );
        }

        const result = await readJsonResponse(response);

        if (result.success !== true) {
            throw new Error(
                "The server did not confirm that the settings were saved."
            );
        }

        // Clear the secret immediately. Never retain it in the page.
        secretInput.value = "";
        secretInput.type = "password";

        const toggleButton = document.querySelector(
            '.password-toggle[data-target="secretKey"]'
        );

        if (toggleButton) {
            toggleButton.setAttribute("aria-pressed", "false");
            toggleButton.setAttribute("aria-label", "Show secret key");

            const icon = toggleButton.querySelector("i");

            if (icon) {
                icon.className = "bx bx-show";
            }
        }

        // Update only the non-secret configuration status.
        configuredNotice.hidden = false;

        showMessage(
            "Payment settings saved successfully.",
            "success"
        );

    } catch (error) {
        secretInput.value = "";

        showMessage(
            error.message ||
            "Unable to save payment settings. Please try again.",
            "error"
        );

    } finally {
        setSaving(false);
        buttonText.textContent = "Save Payment Settings";
        buttonIcon.className = "bx bx-save";
    }
}

/* =========================================
   API HELPERS
========================================= */

async function apiRequest(method, body) {
    const endpoint = LEVEL_UP_CONFIG.SETTINGS_ENDPOINT;
    const base = LEVEL_UP_CONFIG.API_BASE_URL;

    const url = new URL(endpoint, base || window.location.origin);

    if (base && url.origin !== new URL(base).origin) {
        throw new Error("The configured payment API URL is invalid.");
    }

    if (
        window.location.protocol === "https:" &&
        url.protocol !== "https:"
    ) {
        throw new Error("Payment settings must be sent over HTTPS.");
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        LEVEL_UP_CONFIG.REQUEST_TIMEOUT
    );

    try {
        const options = {
            method,
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            },
            signal: controller.signal
        };

        if (body) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        return await fetch(url.toString(), options);

    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                "The request timed out. Please try again."
            );
        }

        throw new Error(
            "Unable to connect to the backend. Check the API configuration."
        );

    } finally {
        clearTimeout(timeoutId);
    }
}

async function readJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error(
            "The server returned an unexpected response. Check the backend configuration."
        );
    }

    return response.json();
}

async function tryReadError(response) {
    try {
        const data = await response.json();

        // Only accept a general message, never display credential fields.
        return {
            message: typeof data.message === "string"
                ? data.message
                : ""
        };
    } catch {
        return { message: "" };
    }
}

/* =========================================
   FORM UI HELPERS
========================================= */

function setSaving(isSaving) {
    const button = document.getElementById("saveSettingsButton");
    const method = document.getElementById("paymentMethod");
    const publicKey = document.getElementById("publicKey");
    const secretKey = document.getElementById("secretKey");

    button.disabled = isSaving;
    method.disabled = isSaving;
    publicKey.disabled = isSaving;
    secretKey.disabled = isSaving;
}

function showMessage(message, type) {
    const element = document.getElementById("formMessage");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `form-message ${type}`;
    element.hidden = false;
}

function hideMessage() {
    const element = document.getElementById("formMessage");

    if (!element) {
        return;
    }

    element.hidden = true;
    element.textContent = "";
    element.className = "form-message";
}
