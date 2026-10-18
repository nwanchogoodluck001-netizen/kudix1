"use strict";

/*
 * KUDIX Manage Streak
 *
 * Frontend only.
 * Configure API_BASE_URL and endpoint paths when your backend is ready.
 * No demo statistics or fabricated claim records are displayed.
 */

const STREAK_API = {
    baseUrl: "",
    summary: "/api/admin/streak/summary",
    rules: "/api/admin/streak/rules",
    activity: "/api/admin/streak/claims"
};

const $ = (id) => document.getElementById(id);

const elements = {
    sidebar: $("sidebar"),
    sidebarOverlay: $("sidebarOverlay"),
    openSidebar: $("openSidebar"),
    closeSidebar: $("closeSidebar"),

    connectionStatus: $("connectionStatus"),
    connectionText: $("connectionText"),
    backendNotice: $("backendNotice"),

    totalClaims: $("totalClaims"),
    totalFunds: $("totalFunds"),

    form: $("streakRulesForm"),
    systemStatus: $("systemStatus"),
    referralRequired: $("referralRequired"),
    minReward: $("minReward"),
    maxReward: $("maxReward"),
    rewardRange: $("rewardRange"),
    formMessage: $("formMessage"),
    saveConfiguration: $("saveConfiguration"),

    refreshActivity: $("refreshActivity"),
    activityTableBody: $("activityTableBody"),
    activityCount: $("activityCount"),

    toast: $("toast"),
    toastText: $("toastText")
};

const state = {
    rulesLoaded: false,
    summaryLoaded: false,
    activityLoaded: false,
    loadingActivity: false
};

const moneyFormatter = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat("en-NG");

/* ---------------------------------
   API helpers
---------------------------------- */

function apiConfigured() {
    return typeof STREAK_API.baseUrl === "string" &&
        STREAK_API.baseUrl.trim() !== "";
}

function setConnectionStatus(connected) {
    elements.connectionStatus.classList.toggle("connected", connected);

    elements.connectionText.textContent = connected
        ? "Backend available"
        : "Backend not configured";

    elements.backendNotice.hidden = connected;
}

function buildApiUrl(endpoint) {
    if (!apiConfigured()) {
        throw new Error("The backend API has not been configured.");
    }

    return new URL(endpoint, STREAK_API.baseUrl).toString();
}

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(buildApiUrl(endpoint), {
        ...options,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`Server request failed (${response.status}).`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

/* ---------------------------------
   Formatting and safe rendering
---------------------------------- */

function formatMoney(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value))
    ) {
        return "—";
    }

    return moneyFormatter.format(Number(value));
}

function formatCount(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < 0
    ) {
        return "—";
    }

    return numberFormatter.format(Number(value));
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function showToast(message) {
    elements.toastText.textContent = message;
    elements.toast.hidden = false;
}

function showFormMessage(message, success = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.className = success
        ? "form-message success"
        : "form-message";

    elements.formMessage.hidden = false;
}

function clearFormMessage() {
    elements.formMessage.textContent = "";
    elements.formMessage.hidden = true;
    elements.formMessage.className = "form-message";
}

function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text == null ? "—" : String(text);

    if (className) {
        cell.className = className;
    }

    return cell;
}

function createStatusBadge(value, type) {
    const badge = document.createElement("span");
    const status = String(value || "unknown").toLowerCase();

    const labels = {
        verified: "Verified",
        unverified: "Unverified",
        eligible: "Eligible",
        ineligible: "Not eligible",
        success: "Successful",
        successful: "Successful",
        claimed: "Claimed",
        pending: "Pending",
        failed: "Failed",
        rejected: "Rejected",
        unknown: "Unknown"
    };

    let cssClass = "status-badge";

    if (type === "referral") {
        if (["verified", "eligible"].includes(status)) {
            cssClass += " verified";
        } else if (["unverified", "ineligible"].includes(status)) {
            cssClass += " unverified";
        } else {
            cssClass += " pending";
        }
    } else {
        if (["success", "successful", "claimed"].includes(status)) {
            cssClass += " success";
        } else if (["failed", "rejected"].includes(status)) {
            cssClass += " failed";
        } else {
            cssClass += " pending";
        }
    }

    badge.className = cssClass;
    badge.textContent = labels[status] || "Unknown";

    return badge;
}

function setTableMessage(title, description, icon = "bx-folder-open") {
    elements.activityTableBody.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.className = "table-state";

    const iconElement = document.createElement("i");
    iconElement.className = `bx ${icon}`;

    const heading = document.createElement("strong");
    heading.textContent = title;

    const descriptionElement = document.createElement("span");
    descriptionElement.textContent = description;

    cell.append(iconElement, heading, descriptionElement);
    row.appendChild(cell);
    elements.activityTableBody.appendChild(row);
}

/* ---------------------------------
   Mobile sidebar
---------------------------------- */

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
    }
});

/* ---------------------------------
   Summary statistics
---------------------------------- */

async function loadSummary() {
    if (!apiConfigured()) {
        elements.totalClaims.textContent = "—";
        elements.totalFunds.textContent = "—";
        state.summaryLoaded = false;
        return;
    }

    try {
        const response = await apiRequest(STREAK_API.summary);

        if (!response || typeof response !== "object") {
            throw new Error("The server returned an invalid summary.");
        }

        elements.totalClaims.textContent = formatCount(
            response.totalClaims
        );

        elements.totalFunds.textContent = formatMoney(
            response.totalFundsAwarded
        );

        state.summaryLoaded = true;
        setConnectionStatus(true);

    } catch (error) {
        console.error("Could not load streak summary:", error);

        elements.totalClaims.textContent = "—";
        elements.totalFunds.textContent = "—";
        state.summaryLoaded = false;
    }
}

/* ---------------------------------
   Streak rules
---------------------------------- */

function readRulesForm() {
    const referralValue = elements.referralRequired.value.trim();
    const minValue = elements.minReward.value.trim();
    const maxValue = elements.maxReward.value.trim();

    if (referralValue === "" || minValue === "" || maxValue === "") {
        throw new Error("Please complete all required fields.");
    }

    const referrals = Number(referralValue);
    const minReward = Number(minValue);
    const maxReward = Number(maxValue);

    if (!Number.isSafeInteger(referrals) || referrals < 0) {
        throw new Error("Referral requirement must be a whole number of zero or greater.");
    }

    if (!Number.isFinite(minReward) || minReward < 0) {
        throw new Error("Minimum reward must be a valid, non-negative amount.");
    }

    if (!Number.isFinite(maxReward) || maxReward < 0) {
        throw new Error("Maximum reward must be a valid, non-negative amount.");
    }

    if (minReward > maxReward) {
        throw new Error("Minimum reward cannot be greater than maximum reward.");
    }

    return {
        systemStatus: elements.systemStatus.value,
        referralRequired: referrals,
        minReward,
        maxReward
    };
}

function updateRewardPreview() {
    const minValue = elements.minReward.value.trim();
    const maxValue = elements.maxReward.value.trim();

    if (!minValue || !maxValue) {
        elements.rewardRange.textContent =
            "Enter a minimum and maximum reward to preview the range.";
        return;
    }

    const minimum = Number(minValue);
    const maximum = Number(maxValue);

    if (
        !Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum < 0 ||
        maximum < 0
    ) {
        elements.rewardRange.textContent =
            "Enter valid, non-negative reward amounts.";
        return;
    }

    if (minimum > maximum) {
        elements.rewardRange.textContent =
            "The minimum reward cannot exceed the maximum reward.";
        return;
    }

    elements.rewardRange.textContent =
        `${formatMoney(minimum)} – ${formatMoney(maximum)}`;
}

elements.minReward.addEventListener("input", updateRewardPreview);
elements.maxReward.addEventListener("input", updateRewardPreview);

async function loadRules() {
    if (!apiConfigured()) {
        state.rulesLoaded = false;
        return;
    }

    try {
        const response = await apiRequest(STREAK_API.rules);
        const rules = response?.rules;

        if (!rules || typeof rules !== "object") {
            throw new Error("The server did not return saved streak rules.");
        }

        if (
            rules.systemStatus === "enabled" ||
            rules.systemStatus === "disabled"
        ) {
            elements.systemStatus.value = rules.systemStatus;
        }

        if (
            Number.isSafeInteger(rules.referralRequired) &&
            rules.referralRequired >= 0
        ) {
            elements.referralRequired.value = String(
                rules.referralRequired
            );
        }

        if (
            Number.isFinite(rules.minReward) &&
            rules.minReward >= 0
        ) {
            elements.minReward.value = String(rules.minReward);
        }

        if (
            Number.isFinite(rules.maxReward) &&
            rules.maxReward >= 0
        ) {
            elements.maxReward.value = String(rules.maxReward);
        }

        updateRewardPreview();
        state.rulesLoaded = true;
        setConnectionStatus(true);

    } catch (error) {
        console.error("Could not load streak rules:", error);
        state.rulesLoaded = false;
    }
}

elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormMessage();

    let payload;

    try {
        payload = readRulesForm();
    } catch (error) {
        showFormMessage(error.message);
        return;
    }

    if (!apiConfigured()) {
        showFormMessage(
            "Configuration was not saved. Connect the backend API first."
        );
        return;
    }

    const originalContent = elements.saveConfiguration.innerHTML;

    elements.saveConfiguration.disabled = true;
    elements.saveConfiguration.innerHTML =
        '<i class="bx bx-loader-alt bx-spin"></i><span>Saving...</span>';

    try {
        await apiRequest(STREAK_API.rules, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        state.rulesLoaded = true;

        showFormMessage(
            "Streak configuration saved successfully by the server.",
            true
        );

        showToast("Streak configuration saved.");

    } catch (error) {
        console.error("Could not save streak configuration:", error);

        showFormMessage(
            `Could not save configuration: ${error.message}`
        );

    } finally {
        elements.saveConfiguration.disabled = false;
        elements.saveConfiguration.innerHTML = originalContent;
    }
});

/* ---------------------------------
   Recent streak activity
---------------------------------- */

function normalizeReferralStatus(value) {
    const status = String(value || "").toLowerCase();

    if (["verified", "eligible"].includes(status)) {
        return "verified";
    }

    if (["unverified", "ineligible"].includes(status)) {
        return "unverified";
    }

    return "pending";
}

function normalizeClaimStatus(value) {
    const status = String(value || "").toLowerCase();

    if (["success", "successful", "claimed"].includes(status)) {
        return "success";
    }

    if (["failed", "rejected"].includes(status)) {
        return "failed";
    }

    return "pending";
}

function renderActivity(records) {
    elements.activityTableBody.replaceChildren();

    if (!records.length) {
        setTableMessage(
            "No streak claims found",
            "No claim records were returned for this activity list."
        );

        elements.activityCount.textContent = "0 records";
        return;
    }

    records.forEach((record) => {
        const row = document.createElement("tr");

        const userCell = document.createElement("td");
        const userWrapper = document.createElement("div");
        userWrapper.className = "user-cell";

        const avatar = document.createElement("span");
        avatar.className = "user-avatar";
        avatar.setAttribute("aria-hidden", "true");

        const avatarIcon = document.createElement("i");
        avatarIcon.className = "bx bx-user";
        avatar.appendChild(avatarIcon);

        const userName = document.createElement("span");
        userName.className = "user-name";
        userName.textContent = record.username || "User";

        userWrapper.append(avatar, userName);
        userCell.appendChild(userWrapper);

        const dateCell = createCell(formatDate(record.claimedAt));
        const rewardCell = createCell(formatMoney(record.rewardAmount));

        const referralCell = document.createElement("td");
        referralCell.appendChild(
            createStatusBadge(
                normalizeReferralStatus(record.referralStatus),
                "referral"
            )
        );

        const claimCell = document.createElement("td");
        claimCell.appendChild(
            createStatusBadge(
                normalizeClaimStatus(record.claimStatus),
                "claim"
            )
        );

        row.append(
            userCell,
            dateCell,
            rewardCell,
            referralCell,
            claimCell
        );

        elements.activityTableBody.appendChild(row);
    });

    elements.activityCount.textContent =
        `${numberFormatter.format(records.length)} records`;
}

async function loadActivity() {
    if (state.loadingActivity) return;

    if (!apiConfigured()) {
        state.activityLoaded = false;

        setTableMessage(
            "Backend connection required",
            "Connect the backend to load actual streak claim records."
        );

        elements.activityCount.textContent = "No records loaded";
        return;
    }

    state.loadingActivity = true;
    elements.refreshActivity.disabled = true;
    elements.refreshActivity.innerHTML =
        '<i class="bx bx-loader-alt bx-spin"></i> Loading';

    setTableMessage(
        "Loading streak activity",
        "Retrieving records from the server.",
        "bx-loader-alt bx-spin"
    );

    try {
        const response = await apiRequest(STREAK_API.activity);

        if (!Array.isArray(response?.claims)) {
            throw new Error("The server returned an invalid claims list.");
        }

        renderActivity(response.claims);
        state.activityLoaded = true;
        setConnectionStatus(true);

    } catch (error) {
        console.error("Could not load streak activity:", error);

        setTableMessage(
            "Unable to load activity",
            "Check the backend connection and try refreshing.",
            "bx-error-circle"
        );

        elements.activityCount.textContent = "Activity unavailable";
        state.activityLoaded = false;

    } finally {
        state.loadingActivity = false;
        elements.refreshActivity.disabled = false;
        elements.refreshActivity.innerHTML =
            '<i class="bx bx-refresh"></i> Refresh';
    }
}

elements.refreshActivity.addEventListener("click", async () => {
    await loadActivity();
    await loadSummary();
});

/* ---------------------------------
   Initial page load
---------------------------------- */

async function initializeStreakPage() {
    updateRewardPreview();

    if (!apiConfigured()) {
        setConnectionStatus(false);

        elements.totalClaims.textContent = "—";
        elements.totalFunds.textContent = "—";

        setTableMessage(
            "Backend connection required",
            "Connect the backend to view actual streak claims."
        );

        elements.activityCount.textContent = "No records loaded";
        return;
    }

    const results = await Promise.allSettled([
        loadSummary(),
        loadRules(),
        loadActivity()
    ]);

    const hasSuccessfulRequest = results.some(
        (result) => result.status === "fulfilled"
    );

    if (hasSuccessfulRequest) {
        setConnectionStatus(true);
    }
}

initializeStreakPage();