
"use strict";

/*
 * KUDIX — Manage Support
 *
 * GET /api/admin/settings/support
 * PUT /api/admin/settings/support
 *
 * The backend must authenticate and authorize admin requests.
 */

const SUPPORT_API = {
    baseUrl: "",
    timeout: 15000
};

document.addEventListener("DOMContentLoaded", () => {
    initializeSidebar();
    initializeSupportForm();
    loadSupportLinks();
});

/* =========================================
   MOBILE SIDEBAR
========================================= */

function initializeSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const openButton = document.getElementById("openSidebar");
    const closeButton = document.getElementById("closeSidebar");

    if (!sidebar || !overlay || !openButton || !closeButton) return;

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
            if (window.innerWidth <= 760) closeSidebar();
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
   API HELPER
========================================= */

async function supportApiRequest(path, options = {}) {
    const baseUrl = SUPPORT_API.baseUrl;
    const url = new URL(
        path,
        baseUrl || window.location.origin
    );

    if (baseUrl && url.origin !== new URL(baseUrl).origin) {
        throw new Error("Invalid API endpoint configuration.");
    }

    if (
        window.location.protocol === "https:" &&
        url.protocol !== "https:"
    ) {
        throw new Error("Support settings must be accessed over HTTPS.");
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        SUPPORT_API.timeout
    );

    try {
        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        const requestOptions = {
            method: options.method || "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers,
            signal: controller.signal
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            requestOptions.body = JSON.stringify(options.body);
        }

        return await fetch(url.toString(), requestOptions);

    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("The request timed out. Please try again.");
        }

        throw new Error(
            "Unable to connect to the support settings backend."
        );

    } finally {
        clearTimeout(timeoutId);
    }
}

async function readResponseJson(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error("The server returned an unexpected response.");
    }

    return response.json();
}

async function handleResponse(response, fallbackMessage) {
    if (response.status === 401 || response.status === 403) {
        throw new Error(
            "Administrator authentication is required to manage support settings."
        );
    }

    if (!response.ok) {
        let message = fallbackMessage;

        try {
            const data = await readResponseJson(response);

            if (typeof data.message === "string") {
                message = data.message;
            }
        } catch {
            // Retain the safe fallback message.
        }

        throw new Error(message);
    }

    return readResponseJson(response);
}

/* =========================================
   LOAD SUPPORT LINKS
========================================= */

async function loadSupportLinks() {
    setFormLoading(true);
    showMessage("Loading saved support links...", "info");

    try {
        const response = await supportApiRequest(
            "/api/admin/settings/support"
        );

        const data = await handleResponse(
            response,
            "Unable to load support settings."
        );

        if (!data.support || typeof data.support !== "object") {
            throw new Error("The server returned invalid support settings.");
        }

        const telegram = data.support.telegram;
        const whatsapp = data.support.whatsapp;
        const email = data.support.email;

        if (
            typeof telegram !== "string" ||
            typeof whatsapp !== "string" ||
            typeof email !== "string"
        ) {
            throw new Error("The support links are missing or invalid.");
        }

        document.getElementById("telegram").value = telegram;
        document.getElementById("whatsapp").value = whatsapp;
        document.getElementById("email").value = email;

        showMessage("Saved support links loaded successfully.", "success");

    } catch (error) {
        showMessage(error.message, "error");

    } finally {
        setFormLoading(false);
    }
}

/* =========================================
   FORM AND VALIDATION
========================================= */

function initializeSupportForm() {
    const form = document.getElementById("supportForm");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const values = getSupportFormValues();
        const validationError = validateSupportLinks(values);

        if (validationError) {
            showMessage(validationError.message, "error");
            validationError.field.focus();
            return;
        }

        await saveSupportLinks(values);
    });
}

function getSupportFormValues() {
    return {
        telegram: document.getElementById("telegram").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim(),
        email: document.getElementById("email").value.trim()
    };
}

function validateSupportLinks(values) {
    const telegramField = document.getElementById("telegram");
    const whatsappField = document.getElementById("whatsapp");
    const emailField = document.getElementById("email");

    const telegramUrl = parseUrl(values.telegram);
    const whatsappUrl = parseUrl(values.whatsapp);

    if (!telegramUrl || telegramUrl.protocol !== "https:") {
        return {
            field: telegramField,
            message: "Enter a valid HTTPS Telegram support link."
        };
    }

    if (
        !["t.me", "telegram.me"].includes(
            telegramUrl.hostname.toLowerCase()
        )
    ) {
        return {
            field: telegramField,
            message: "Use a Telegram link from t.me or telegram.me."
        };
    }

    if (!whatsappUrl || whatsappUrl.protocol !== "https:") {
        return {
            field: whatsappField,
            message: "Enter a valid HTTPS WhatsApp support link."
        };
    }

    if (
        !["wa.me", "api.whatsapp.com"].includes(
            whatsappUrl.hostname.toLowerCase()
        )
    ) {
        return {
            field: whatsappField,
            message: "Use a WhatsApp link from wa.me or api.whatsapp.com."
        };
    }

    if (
        !values.email ||
        values.email.length > 254 ||
        !emailField.validity.valid
    ) {
        return {
            field: emailField,
            message: "Enter a valid support email address."
        };
    }

    return null;
}

function parseUrl(value) {
    try {
        const url = new URL(value);

        if (url.username || url.password) return null;

        return url;
    } catch {
        return null;
    }
}

/* =========================================
   SAVE SUPPORT LINKS
========================================= */

let saveInProgress = false;

async function saveSupportLinks(values) {
    if (saveInProgress) return;

    saveInProgress = true;
    setFormLoading(true);

    showMessage("Saving support links...", "info");

    try {
        const response = await supportApiRequest(
            "/api/admin/settings/support",
            {
                method: "PUT",
                body: {
                    telegram: values.telegram,
                    whatsapp: values.whatsapp,
                    email: values.email
                }
            }
        );

        const result = await handleResponse(
            response,
            "Unable to save support settings."
        );

        if (result.success !== true) {
            throw new Error(
                "The server did not confirm that the support links were saved."
            );
        }

        showMessage(
            "Support links saved successfully.",
            "success"
        );

    } catch (error) {
        showMessage(error.message, "error");

    } finally {
        saveInProgress = false;
        setFormLoading(false);
    }
}

/* =========================================
   UI HELPERS
========================================= */

function setFormLoading(loading) {
    const button = document.getElementById("saveButton");
    const icon = document.getElementById("saveIcon");
    const text = document.getElementById("saveButtonText");

    button.disabled = loading;

    document.getElementById("telegram").disabled = loading;
    document.getElementById("whatsapp").disabled = loading;
    document.getElementById("email").disabled = loading;

    text.textContent = loading ? "Please wait..." : "Save";

    icon.className = loading
        ? "bx bx-loader-alt is-loading"
        : "bx bx-save";
}

function showMessage(message, type) {
    const element = document.getElementById("pageMessage");

    element.textContent = message;
    element.className = `page-message ${type}`;
    element.hidden = false;
}
