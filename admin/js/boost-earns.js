
"use strict";

/*
 * KUDIX — Boost Earns
 *
 * Backend endpoint required:
 * GET /api/admin/users/lookup?query=USERNAME_OR_EMAIL_OR_ID
 *
 * Expected successful response:
 * {
 *   "user": {
 *     "username": "example",
 *     "userId": "USER_ID",
 *     "accountStatus": "active",
 *     "totalEarnings": 1250,
 *     "boostEarnings": 450,
 *     "lastBoostActivity": "2026-10-16T10:30:00Z",
 *     "currency": "NGN"
 *   }
 * }
 *
 * Configure API_BASE_URL if your backend uses another origin.
 * Leave it empty for a same-origin backend.
 */

const BOOST_EARNS_CONFIG = {
    API_BASE_URL: "",
    LOOKUP_ENDPOINT: "/api/admin/users/lookup",
    REQUEST_TIMEOUT: 15000
};

document.addEventListener("DOMContentLoaded", () => {
    initializeSidebar();
    initializeUserSearch();
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

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" &&
            sidebar.classList.contains("sidebar-open")) {
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
   USER SEARCH
========================================= */

function initializeUserSearch() {
    const form = document.getElementById("userSearchForm");
    const input = document.getElementById("userSearchInput");
    const clearButton = document.getElementById("clearSearch");

    if (!form || !input || !clearButton) {
        return;
    }

    input.addEventListener("input", () => {
        clearButton.hidden = input.value.length === 0;

        // Remove outdated feedback when the user changes the search.
        hideMessage();
    });

    clearButton.addEventListener("click", () => {
        input.value = "";
        clearButton.hidden = true;
        hideMessage();
        resetUserResults();
        input.focus();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const query = input.value.trim();

        if (!query) {
            showMessage(
                "Please enter a username, email address, or user ID.",
                "error"
            );

            input.focus();
            return;
        }

        if (query.length > 200) {
            showMessage("Your search is too long.", "error");
            input.focus();
            return;
        }

        await fetchUser(query);
    });
}

/* =========================================
   FETCH USER FROM BACKEND
========================================= */

async function fetchUser(query) {
    const button = document.getElementById("fetchUserButton");
    const buttonText = document.getElementById("fetchButtonText");
    const buttonIcon = document.getElementById("fetchButtonIcon");

    if (button.disabled) {
        return;
    }

    if (!BOOST_EARNS_CONFIG.API_BASE_URL &&
        !BOOST_EARNS_CONFIG.LOOKUP_ENDPOINT) {
        showMessage(
            "User lookup is not connected. Configure the backend API endpoint first.",
            "error"
        );
        return;
    }

    const endpoint = buildLookupUrl(query);

    setLoading(true);

    buttonText.textContent = "Fetching...";
    buttonIcon.className = "bx bx-loader-alt";
    buttonIcon.classList.add("is-loading");

    showMessage("Searching for the requested user...", "info");
    resetUserResults();

    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        BOOST_EARNS_CONFIG.REQUEST_TIMEOUT
    );

    try {
        const response = await fetch(endpoint, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            },
            cache: "no-store",
            signal: controller.signal
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                "You are not authorized to access this information. Please sign in with an authorized admin account."
            );
        }

        if (response.status === 404) {
            throw new Error(
                "No matching user was found. Check the details and try again."
            );
        }

        if (response.status === 429) {
            throw new Error(
                "Too many search requests. Please wait a moment and try again."
            );
        }

        if (!response.ok) {
            if (response.status >= 500) {
                throw new Error(
                    "The server could not complete the search. Please try again later."
                );
            }

            throw new Error(
                "The search request failed. Please check your input and try again."
            );
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error(
                "The server returned an unexpected response. Check the backend API configuration."
            );
        }

        const result = await response.json();

        // Support the documented { user: {...} } response.
        const user = result && result.user;

        if (!user || typeof user !== "object" || Array.isArray(user)) {
            throw new Error(
                "The server response did not contain valid user information."
            );
        }

        renderUser(user);

        showMessage("User information loaded successfully.", "success");

    } catch (error) {
        resetUserResults();

        if (error.name === "AbortError") {
            showMessage(
                "The request timed out. Please check your connection and try again.",
                "error"
            );
        } else {
            showMessage(
                error.message ||
                "Unable to retrieve user information. Please try again.",
                "error"
            );
        }

    } finally {
        clearTimeout(timeoutId);
        setLoading(false);

        buttonText.textContent = "Fetch User";
        buttonIcon.className = "bx bx-search-alt-2";
    }
}

/* =========================================
   API URL
========================================= */

function buildLookupUrl(query) {
    const base = BOOST_EARNS_CONFIG.API_BASE_URL;
    const endpoint = BOOST_EARNS_CONFIG.LOOKUP_ENDPOINT;

    // Use the current website origin when no separate API base is set.
    const url = new URL(
        endpoint,
        base || window.location.origin
    );

    // Do not allow an API base URL to silently change the destination.
    if (base) {
        const configuredOrigin = new URL(base).origin;

        if (url.origin !== configuredOrigin) {
            throw new Error("The configured API URL is invalid.");
        }
    }

    url.searchParams.set("query", query);

    return url.toString();
}

/* =========================================
   RENDER USER INFORMATION
========================================= */

function renderUser(user) {
    const results = document.getElementById("userResults");
    const emptyState = document.getElementById("emptyState");

    const username = getSafeText(user.username);
    const userId = getSafeText(user.userId);
    const accountStatus = getSafeText(user.accountStatus);

    setText("resultUsername", username || "Unnamed user");
    setText("resultUserId", `User ID: ${userId || "Unavailable"}`);

    setAccountStatus(accountStatus || "Unknown");

    setText(
        "resultTotalEarnings",
        formatMoney(user.totalEarnings, user.currency)
    );

    setText(
        "resultBoostEarnings",
        formatMoney(user.boostEarnings, user.currency)
    );

    setText(
        "resultLastActivity",
        formatActivityDate(user.lastBoostActivity)
    );

    emptyState.hidden = true;
    results.hidden = false;
}

/* =========================================
   SAFE DISPLAY HELPERS
========================================= */

function getSafeText(value) {
    if (typeof value !== "string" &&
        typeof value !== "number") {
        return "";
    }

    return String(value).trim();
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);

    if (element) {
        // textContent prevents user-provided values being interpreted as HTML.
        element.textContent = value;
    }
}

function formatMoney(value, currency) {
    if (value === null || value === undefined || value === "") {
        return "Unavailable";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "Unavailable";
    }

    // Only allow supported currency codes returned by the backend.
    const currencyCode =
        typeof currency === "string" &&
            /^[A-Z]{3}$/.test(currency)
            ? currency
            : "NGN";

    try {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: currencyCode,
            maximumFractionDigits: 2
        }).format(amount);
    } catch {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
}

function formatActivityDate(value) {
    if (!value) {
        return "No recorded boost activity";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Activity date unavailable";
    }

    return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

/* =========================================
   ACCOUNT STATUS
========================================= */

function setAccountStatus(status) {
    const element = document.getElementById("resultAccountStatus");

    if (!element) {
        return;
    }

    element.textContent = status;
    element.className = "account-status";

    const normalized = status.toLowerCase();

    if (normalized === "active") {
        element.classList.add("status-active");
    } else if (
        normalized === "inactive" ||
        normalized === "suspended" ||
        normalized === "disabled"
    ) {
        element.classList.add("status-inactive");
    } else if (
        normalized === "pending" ||
        normalized === "under review"
    ) {
        element.classList.add("status-pending");
    }
}

/* =========================================
   LOADING AND FEEDBACK
========================================= */

function setLoading(isLoading) {
    const button = document.getElementById("fetchUserButton");
    const input = document.getElementById("userSearchInput");

    button.disabled = isLoading;
    input.disabled = isLoading;
}

function showMessage(message, type) {
    const element = document.getElementById("searchMessage");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `feedback-message ${type}`;
    element.hidden = false;
}

function hideMessage() {
    const element = document.getElementById("searchMessage");

    if (!element) {
        return;
    }

    element.hidden = true;
    element.textContent = "";
    element.className = "feedback-message";
}

function resetUserResults() {
    const results = document.getElementById("userResults");
    const emptyState = document.getElementById("emptyState");

    results.hidden = true;
    emptyState.hidden = false;

    setText("resultUsername", "—");
    setText("resultUserId", "User ID: —");
    setText("resultTotalEarnings", "—");
    setText("resultBoostEarnings", "—");
    setText("resultLastActivity", "—");
    setAccountStatus("—");
}
