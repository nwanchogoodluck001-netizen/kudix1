"use strict";

/*
 * KUDIX Admin Dashboard
 *
 * Backend integration is intentionally disabled until real API endpoints
 * and their response formats are supplied.
 *
 * Configure the API URLs below when your backend is ready.
 */

const KUDIX_API = {
    baseUrl: "",

    // Example endpoint paths — replace with your actual backend routes.
    statsEndpoint: "/api/admin/dashboard/stats",
    popupEndpoint: "/api/admin/popup-settings"
};

const elements = {
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    openSidebar: document.getElementById("openSidebar"),
    closeSidebar: document.getElementById("closeSidebar"),

    totalUsers: document.getElementById("totalUsers"),
    totalPayout: document.getElementById("totalPayout"),
    usersStatus: document.getElementById("usersStatus"),
    payoutStatus: document.getElementById("payoutStatus"),

    popupForm: document.getElementById("popupForm"),
    popupMessage: document.getElementById("popupMessage"),
    whatsappLink: document.getElementById("whatsappLink"),
    telegramLink: document.getElementById("telegramLink"),
    messageCount: document.getElementById("messageCount"),
    formMessage: document.getElementById("formMessage"),
    backendNotice: document.getElementById("backendNotice"),
    savePopup: document.getElementById("savePopup"),

    previewPopup: document.getElementById("previewPopup"),
    previewModal: document.getElementById("previewModal"),
    closePreview: document.getElementById("closePreview"),
    donePreview: document.getElementById("donePreview"),
    previewMessage: document.getElementById("previewMessage"),
    previewLinks: document.getElementById("previewLinks"),

    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText")
};

let previousFocus = null;

/* --------------------------------
   API helpers
--------------------------------- */

function isApiConfigured() {
    return Boolean(
        KUDIX_API.baseUrl &&
        KUDIX_API.baseUrl.trim()
    );
}

function getApiUrl(endpoint) {
    if (!isApiConfigured()) {
        throw new Error("The backend API has not been configured.");
    }

    return new URL(
        endpoint,
        KUDIX_API.baseUrl
    ).toString();
}

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(getApiUrl(endpoint), {
        ...options,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`The server returned an error (${response.status}).`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

/* --------------------------------
   Sidebar
--------------------------------- */

function openSidebar() {
    elements.sidebar.classList.add("sidebar-open");
    elements.sidebarOverlay.classList.add("overlay-visible");
    document.body.style.overflow = "hidden";
}

function closeSidebar() {
    elements.sidebar.classList.remove("sidebar-open");
    elements.sidebarOverlay.classList.remove("overlay-visible");
    document.body.style.overflow = "";
}

elements.openSidebar.addEventListener("click", openSidebar);
elements.closeSidebar.addEventListener("click", closeSidebar);
elements.sidebarOverlay.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeSidebar();
        closePreview();
    }
});

/* --------------------------------
   Dashboard statistics
--------------------------------- */

function formatNaira(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Invalid payout amount received.");
    }

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(amount);
}

async function loadDashboardStats() {
    if (!isApiConfigured()) {
        elements.totalUsers.textContent = "—";
        elements.totalPayout.textContent = "—";

        elements.usersStatus.textContent =
            "Unavailable — backend not configured";

        elements.payoutStatus.textContent =
            "Unavailable — backend not configured";

        return;
    }

    elements.usersStatus.textContent = "Loading...";
    elements.payoutStatus.textContent = "Loading...";

    try {
        const data = await apiRequest(KUDIX_API.statsEndpoint);

        /*
         * Expected response:
         * {
         *   "totalUsers": 125,
         *   "totalPayout": 450000
         * }
         *
         * Adapt these field names to your actual backend response.
         */

        if (
            !data ||
            !Number.isSafeInteger(data.totalUsers) ||
            data.totalUsers < 0
        ) {
            throw new Error("The total users response is invalid.");
        }

        elements.totalUsers.textContent =
            new Intl.NumberFormat("en-NG").format(data.totalUsers);

        elements.usersStatus.textContent =
            "Registered users reported by the server";

        elements.totalPayout.textContent =
            formatNaira(data.totalPayout);

        elements.payoutStatus.textContent =
            "Payout total reported by the server";

    } catch (error) {
        console.error("Dashboard statistics:", error);

        elements.totalUsers.textContent = "—";
        elements.totalPayout.textContent = "—";

        elements.usersStatus.textContent =
            "Could not load user statistics";

        elements.payoutStatus.textContent =
            "Could not load payout statistics";
    }
}

/* --------------------------------
   Message character counter
--------------------------------- */

function updateMessageCount() {
    const length = elements.popupMessage.value.length;

    elements.messageCount.textContent = `${length} / 2000`;
}

elements.popupMessage.addEventListener("input", updateMessageCount);

/* --------------------------------
   URL validation
--------------------------------- */

function validateHttpsUrl(value, expectedHosts) {
    const input = value.trim();

    // Empty optional links are allowed.
    if (!input) {
        return { valid: true, value: "" };
    }

    try {
        const url = new URL(input);

        if (url.protocol !== "https:") {
            return {
                valid: false,
                message: "Links must use HTTPS."
            };
        }

        if (url.username || url.password) {
            return {
                valid: false,
                message: "Links cannot contain embedded login credentials."
            };
        }

        const hostname = url.hostname.toLowerCase();

        const allowed = expectedHosts.some((host) => {
            return hostname === host || hostname.endsWith(`.${host}`);
        });

        if (!allowed) {
            return {
                valid: false,
                message: `Use an approved link from ${expectedHosts.join(" or ")}.`
            };
        }

        return {
            valid: true,
            value: url.href
        };

    } catch {
        return {
            valid: false,
            message: "Enter a valid URL, including https://."
        };
    }
}

function getPopupFormData() {
    const message = elements.popupMessage.value.trim();

    const whatsapp = validateHttpsUrl(
        elements.whatsappLink.value,
        ["whatsapp.com"]
    );

    const telegram = validateHttpsUrl(
        elements.telegramLink.value,
        ["t.me", "telegram.me", "telegram.org"]
    );

    if (!message) {
        throw new Error("Please enter a pop-up message.");
    }

    if (message.length > 2000) {
        throw new Error("The message cannot exceed 2,000 characters.");
    }

    if (!whatsapp.valid) {
        throw new Error(`WhatsApp link: ${whatsapp.message}`);
    }

    if (!telegram.valid) {
        throw new Error(`Telegram link: ${telegram.message}`);
    }

    return {
        message,
        whatsappLink: whatsapp.value,
        telegramLink: telegram.value
    };
}

/* --------------------------------
   Form notifications
--------------------------------- */

function showFormMessage(message, type = "error") {
    elements.formMessage.textContent = message;
    elements.formMessage.className = `form-message ${type}`;
    elements.formMessage.hidden = false;
}

function clearFormMessage() {
    elements.formMessage.textContent = "";
    elements.formMessage.hidden = true;
    elements.formMessage.className = "form-message";
}

function showToast(message) {
    elements.toastText.textContent = message;
    elements.toast.hidden = false;
}

function hideToast() {
    elements.toast.hidden = true;
}

/* --------------------------------
   Load saved pop-up settings
--------------------------------- */

async function loadPopupSettings() {
    if (!isApiConfigured()) {
        elements.backendNotice.hidden = false;
        return;
    }

    try {
        const settings = await apiRequest(KUDIX_API.popupEndpoint);

        if (!settings) return;

        /*
         * Expected response:
         * {
         *   "message": "Your announcement...",
         *   "whatsappLink": "https://whatsapp.com/channel/...",
         *   "telegramLink": "https://t.me/..."
         * }
         */

        if (typeof settings.message === "string") {
            elements.popupMessage.value = settings.message;
        }

        if (typeof settings.whatsappLink === "string") {
            elements.whatsappLink.value = settings.whatsappLink;
        }

        if (typeof settings.telegramLink === "string") {
            elements.telegramLink.value = settings.telegramLink;
        }

        updateMessageCount();
        elements.backendNotice.hidden = true;

    } catch (error) {
        console.error("Loading pop-up settings:", error);

        elements.backendNotice.hidden = false;

        showFormMessage(
            "Saved settings could not be loaded. Check your backend connection."
        );
    }
}

/* --------------------------------
   Save pop-up settings
--------------------------------- */

elements.popupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormMessage();

    let settings;

    try {
        settings = getPopupFormData();
    } catch (error) {
        showFormMessage(error.message);
        return;
    }

    if (!isApiConfigured()) {
        showFormMessage(
            "Settings were not saved. Configure your backend API before saving."
        );
        showToast("Backend not configured. Nothing was saved.");
        return;
    }

    const originalButton = elements.savePopup.innerHTML;

    elements.savePopup.disabled = true;
    elements.savePopup.innerHTML =
        '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

    try {
        /*
         * The backend must verify the administrator's authorization.
         * It should also validate these fields on the server.
         *
         * If your backend uses a cross-origin API, configure the correct
         * credentials, CORS policy, and CSRF protection for your setup.
         */

        await apiRequest(KUDIX_API.popupEndpoint, {
            method: "PUT",
            body: JSON.stringify(settings)
        });

        showFormMessage(
            "Pop-up settings saved successfully.",
            "success"
        );

        showToast("Pop-up settings saved.");

        elements.backendNotice.hidden = true;

    } catch (error) {
        console.error("Saving pop-up settings:", error);

        showFormMessage(
            `Unable to save settings: ${error.message}`
        );
    } finally {
        elements.savePopup.disabled = false;
        elements.savePopup.innerHTML = originalButton;
    }
});

/* --------------------------------
   Pop-up preview
--------------------------------- */

function createPreviewLink(label, url, iconClass) {
    const anchor = document.createElement("a");

    anchor.className = "preview-link";
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";

    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = label;

    anchor.append(icon, text);

    return anchor;
}

function openPreview() {
    clearFormMessage();

    let settings;

    try {
        settings = getPopupFormData();
    } catch (error) {
        showFormMessage(error.message);
        return;
    }

    elements.previewMessage.textContent = settings.message;
    elements.previewLinks.replaceChildren();

    if (settings.whatsappLink) {
        elements.previewLinks.appendChild(
            createPreviewLink(
                "Join our WhatsApp Channel",
                settings.whatsappLink,
                "bx bxl-whatsapp"
            )
        );
    }

    if (settings.telegramLink) {
        elements.previewLinks.appendChild(
            createPreviewLink(
                "Join our Telegram Channel",
                settings.telegramLink,
                "bx bxl-telegram"
            )
        );
    }

    if (!settings.whatsappLink && !settings.telegramLink) {
        const note = document.createElement("p");
        note.className = "stat-footnote";
        note.textContent = "No channel links have been added.";
        elements.previewLinks.appendChild(note);
    }

    previousFocus = document.activeElement;
    elements.previewModal.hidden = false;
    document.body.style.overflow = "hidden";

    elements.closePreview.focus();
}

function closePreview() {
    if (elements.previewModal.hidden) return;

    elements.previewModal.hidden = true;
    document.body.style.overflow = "";

    if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
    }
}

elements.previewPopup.addEventListener("click", openPreview);
elements.closePreview.addEventListener("click", closePreview);
elements.donePreview.addEventListener("click", closePreview);

elements.previewModal.addEventListener("click", (event) => {
    if (event.target === elements.previewModal) {
        closePreview();
    }
});

/* --------------------------------
   Initial page setup
--------------------------------- */

updateMessageCount();
loadDashboardStats();
loadPopupSettings();