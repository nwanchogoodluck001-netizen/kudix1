
"use strict";

/*
 * KUDIX — Withdrawal Configuration
 *
 * Required backend endpoints:
 *
 * GET  /api/admin/withdrawals/summary
 * GET  /api/admin/withdrawals/config
 * PUT  /api/admin/withdrawals/config
 * GET  /api/admin/withdrawals/requests?status=pending
 * POST /api/admin/withdrawals/requests/:id/action
 * POST /api/admin/withdrawals/bulk-action
 *
 * See the expected API contract after the code.
 *
 * No mock data or simulated successful actions are used.
 */

const WITHDRAWAL_CONFIG = {
    API_BASE_URL: "",
    REQUEST_TIMEOUT: 20000
};

const withdrawalState = {
    requests: [],
    busyIds: new Set(),
    bulkBusy: false,
    configBusy: false,
    loading: false,
    actionInProgress: false,
    pendingDialogAction: null
};

document.addEventListener("DOMContentLoaded", () => {
    initializeSidebar();
    initializeWithdrawalForm();
    initializeConfirmationDialog();
    initializeRefreshButtons();
    loadPageData();
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

        if (window.innerWidth <= 760) openButton.focus();
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
   REFRESH
========================================= */

function initializeRefreshButtons() {
    document.getElementById("refreshPage").addEventListener(
        "click",
        loadPageData
    );

    document.getElementById("retryRequests").addEventListener(
        "click",
        loadRequests
    );
}

async function loadPageData() {
    if (withdrawalState.loading) return;

    withdrawalState.loading = true;

    const refreshButton = document.getElementById("refreshPage");
    refreshButton.disabled = true;

    showMessage("Loading withdrawal information...", "info");

    const results = await Promise.allSettled([
        loadSummary(),
        loadWithdrawalConfig(),
        loadRequests()
    ]);

    const failed = results.some(
        (result) => result.status === "rejected"
    );

    withdrawalState.loading = false;
    refreshButton.disabled = false;

    if (failed) {
        showMessage(
            "Some withdrawal information could not be loaded. Check the backend connection and retry.",
            "error"
        );
    } else {
        showMessage("Withdrawal information refreshed.", "success");
    }
}

/* =========================================
   API REQUEST HELPER
========================================= */

async function apiRequest(path, options = {}) {
    const base = WITHDRAWAL_CONFIG.API_BASE_URL;
    const url = new URL(
        path,
        base || window.location.origin
    );

    if (base && url.origin !== new URL(base).origin) {
        throw new Error("Invalid API endpoint configuration.");
    }

    if (
        window.location.protocol === "https:" &&
        url.protocol !== "https:"
    ) {
        throw new Error("Withdrawal requests must use HTTPS.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
        () => controller.abort(),
        WITHDRAWAL_CONFIG.REQUEST_TIMEOUT
    );

    try {
        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        const fetchOptions = {
            method: options.method || "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers,
            signal: controller.signal
        };

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
            fetchOptions.body = JSON.stringify(options.body);
        }

        return await fetch(url.toString(), fetchOptions);

    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("The request timed out. Please try again.");
        }

        throw new Error(
            "Unable to connect to the withdrawal backend."
        );

    } finally {
        clearTimeout(timeoutId);
    }
}

async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error("The backend returned an unexpected response.");
    }

    return response.json();
}

async function checkedJson(response, fallbackMessage) {
    if (response.status === 401 || response.status === 403) {
        throw new Error(
            "Administrator authentication or authorization is required."
        );
    }

    if (!response.ok) {
        let message = fallbackMessage;

        try {
            const data = await readJson(response);

            if (typeof data.message === "string") {
                message = data.message;
            }
        } catch {
            // Keep the generic fallback if the error body is unavailable.
        }

        throw new Error(message);
    }

    return readJson(response);
}

/* =========================================
   SUMMARY CARDS
========================================= */

async function loadSummary() {
    const response = await apiRequest(
        "/api/admin/withdrawals/summary"
    );

    const data = await checkedJson(
        response,
        "Unable to load withdrawal statistics."
    );

    const summary = data.summary;

    if (!summary || typeof summary !== "object") {
        throw new Error("The summary response is invalid.");
    }

    setText("pendingCount", formatCount(summary.pendingRequests));
    setText("completedCount", formatCount(summary.completedPayouts));
    setText("totalPayout", formatMoney(summary.totalPayout));
    setText("totalUsers", formatCount(summary.totalUsers));
}

function formatCount(value) {
    const number = Number(value);

    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isSafeInteger(number) ||
        number < 0
    ) {
        return "—";
    }

    return new Intl.NumberFormat("en-NG").format(number);
}

function formatMoney(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
    ) {
        return "—";
    }

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(Number(value));
}

/* =========================================
   WITHDRAWAL CONFIGURATION
========================================= */

function initializeWithdrawalForm() {
    const form = document.getElementById("withdrawalConfigForm");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await saveWithdrawalConfig();
    });
}

async function loadWithdrawalConfig() {
    const response = await apiRequest(
        "/api/admin/withdrawals/config"
    );

    const data = await checkedJson(
        response,
        "Unable to load withdrawal configuration."
    );

    const config = data.config;

    if (!config || typeof config !== "object") {
        throw new Error("The withdrawal configuration is invalid.");
    }

    if (!["enabled", "disabled"].includes(config.status)) {
        throw new Error("The backend returned an invalid withdrawal status.");
    }

    const minimum = Number(config.minimumWithdrawal);

    if (!Number.isFinite(minimum) || minimum <= 0) {
        throw new Error("The configured minimum withdrawal amount is invalid.");
    }

    document.getElementById("withdrawalStatus").value = config.status;
    document.getElementById("minimumWithdrawal").value = String(minimum);
}

async function saveWithdrawalConfig() {
    if (withdrawalState.configBusy) return;

    const statusInput = document.getElementById("withdrawalStatus");
    const minimumInput = document.getElementById("minimumWithdrawal");

    const status = statusInput.value;
    const rawMinimum = minimumInput.value.trim();
    const minimum = Number(rawMinimum);

    if (!["enabled", "disabled"].includes(status)) {
        showMessage("Select a valid withdrawal status.", "error");
        statusInput.focus();
        return;
    }

    if (
        rawMinimum === "" ||
        !Number.isFinite(minimum) ||
        minimum <= 0 ||
        !Number.isSafeInteger(minimum)
    ) {
        showMessage(
            "Enter a valid positive whole-number minimum withdrawal amount in NGN.",
            "error"
        );
        minimumInput.focus();
        return;
    }

    withdrawalState.configBusy = true;
    setConfigLoading(true);

    showMessage("Saving withdrawal configuration...", "info");

    try {
        const response = await apiRequest(
            "/api/admin/withdrawals/config",
            {
                method: "PUT",
                body: {
                    status,
                    minimumWithdrawal: minimum
                }
            }
        );

        const result = await checkedJson(
            response,
            "Unable to update withdrawal configuration."
        );

        if (result.success !== true) {
            throw new Error(
                "The server did not confirm the configuration update."
            );
        }

        showMessage(
            "Withdrawal configuration updated successfully.",
            "success"
        );

    } catch (error) {
        showMessage(error.message, "error");

    } finally {
        withdrawalState.configBusy = false;
        setConfigLoading(false);
    }
}

function setConfigLoading(loading) {
    const button = document.getElementById("saveConfigButton");
    const icon = document.getElementById("saveConfigIcon");
    const text = document.getElementById("saveConfigText");

    button.disabled = loading;
    document.getElementById("withdrawalStatus").disabled = loading;
    document.getElementById("minimumWithdrawal").disabled = loading;

    text.textContent = loading
        ? "Updating Configuration..."
        : "Update Withdrawal Config";

    icon.className = loading
        ? "bx bx-loader-alt is-loading"
        : "bx bx-save";
}

/* =========================================
   PENDING REQUESTS
========================================= */

async function loadRequests() {
    const body = document.getElementById("requestsTableBody");
    const footer = document.getElementById("tableFooterText");

    body.replaceChildren();
    body.appendChild(
        createStateRow("Loading withdrawal requests...", true)
    );

    footer.textContent = "Loading requests...";

    try {
        const response = await apiRequest(
            "/api/admin/withdrawals/requests?status=pending"
        );

        const data = await checkedJson(
            response,
            "Unable to load pending withdrawal requests."
        );

        if (!Array.isArray(data.requests)) {
            throw new Error("The withdrawal requests response is invalid.");
        }

        withdrawalState.requests = data.requests.filter(
            (request) =>
                request &&
                request.status === "pending" &&
                typeof request.id === "string" &&
                request.id.trim() !== ""
        );

        renderRequests();

    } catch (error) {
        withdrawalState.requests = [];
        updatePendingControls();

        body.replaceChildren(
            createStateRow(
                "Unable to load withdrawal requests. Use Reload requests to try again."
            )
        );

        footer.textContent = error.message;
        throw error;
    }
}

function renderRequests() {
    const body = document.getElementById("requestsTableBody");
    const footer = document.getElementById("tableFooterText");

    body.replaceChildren();

    if (withdrawalState.requests.length === 0) {
        body.appendChild(
            createStateRow("No pending withdrawal requests.")
        );

        footer.textContent = "There are no pending requests to review.";
        updatePendingControls();
        return;
    }

    withdrawalState.requests.forEach((request) => {
        body.appendChild(createRequestRow(request));
    });

    footer.textContent =
        `${withdrawalState.requests.length} pending request(s) loaded.`;

    updatePendingControls();
}

function createStateRow(message, loading = false) {
    const row = document.createElement("tr");
    row.className = "state-row";

    const cell = document.createElement("td");
    cell.colSpan = 9;
    cell.className = "table-state";

    if (loading) {
        const spinner = document.createElement("span");
        spinner.className = "table-loader";
        spinner.setAttribute("aria-hidden", "true");
        cell.appendChild(spinner);
    }

    cell.appendChild(document.createTextNode(message));
    row.appendChild(cell);

    return row;
}

function createRequestRow(request) {
    const row = document.createElement("tr");

    const user = safeString(request.username, "Unknown user");
    const userId = safeString(request.userId, "Unavailable");
    const bankName = safeString(request.bankName, "Unavailable");
    const accountName = safeString(request.accountName, "Unavailable");
    const requestDate = formatDate(request.requestDate);

    addCell(row, user, "user-cell");
    addCell(row, userId, "user-id-cell");

    addCell(
        row,
        formatMoney(request.amount),
        "amount-cell"
    );

    addCell(row, bankName, "account-cell");

    // Mask account numbers in the table.
    addCell(
        row,
        maskAccountNumber(request.accountNumber),
        "account-cell"
    );

    addCell(row, accountName, "account-cell");
    addCell(row, requestDate);

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");

    statusBadge.className = "request-status";
    statusBadge.textContent = "Pending";
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";

    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "approve-button";
    approve.innerHTML = '<i class="bx bx-check"></i><span>Approve</span>';
    approve.setAttribute(
        "aria-label",
        `Approve withdrawal for ${user}`
    );

    approve.addEventListener("click", () => {
        requestAction(request, "approve");
    });

    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "reject-button";
    reject.innerHTML = '<i class="bx bx-x"></i><span>Reject</span>';
    reject.setAttribute(
        "aria-label",
        `Reject withdrawal for ${user}`
    );

    reject.addEventListener("click", () => {
        requestAction(request, "reject");
    });

    actions.append(approve, reject);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);

    return row;
}

function addCell(row, value, className = "") {
    const cell = document.createElement("td");

    if (className) {
        cell.className = className;
    }

    cell.textContent = value;
    row.appendChild(cell);
}

function safeString(value, fallback = "—") {
    if (
        typeof value !== "string" &&
        typeof value !== "number"
    ) {
        return fallback;
    }

    const result = String(value).trim();
    return result || fallback;
}

function maskAccountNumber(value) {
    const account = safeString(value, "");

    if (!account) return "Unavailable";

    const digits = account.replace(/\s/g, "");

    if (digits.length <= 4) {
        return `••••${digits}`;
    }

    return `••••••${digits.slice(-4)}`;
}

function formatDate(value) {
    if (!value) return "Unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unavailable";
    }

    return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

/* =========================================
   INDIVIDUAL APPROVAL / REJECTION
========================================= */

function requestAction(request, action) {
    if (
        withdrawalState.actionInProgress ||
        withdrawalState.bulkBusy ||
        withdrawalState.busyIds.has(request.id)
    ) {
        return;
    }

    openConfirmation({
        action,
        requestIds: [request.id],
        amount: Number(request.amount),
        title: action === "approve"
            ? "Approve withdrawal request?"
            : "Reject withdrawal request?",
        description:
            `${action === "approve" ? "Approve" : "Reject"} the pending withdrawal ` +
            `request for ${safeString(request.username, "this user")} ` +
            `(${formatMoney(request.amount)})?`,
        confirmLabel: action === "approve" ? "Approve Request" : "Reject Request"
    });
}

/* =========================================
   BULK ACTIONS
========================================= */

function updatePendingControls() {
    const hasRequests = withdrawalState.requests.length > 0;
    const disabled =
        !hasRequests ||
        withdrawalState.bulkBusy ||
        withdrawalState.actionInProgress;

    document.getElementById("approveAllButton").disabled = disabled;
    document.getElementById("rejectAllButton").disabled = disabled;

    document.getElementById("tablePendingCount").textContent =
        `${withdrawalState.requests.length} pending`;
}

document.getElementById("approveAllButton").addEventListener(
    "click",
    () => requestBulkAction("approve")
);

document.getElementById("rejectAllButton").addEventListener(
    "click",
    () => requestBulkAction("reject")
);

function requestBulkAction(action) {
    if (
        withdrawalState.bulkBusy ||
        withdrawalState.actionInProgress ||
        withdrawalState.requests.length === 0
    ) {
        return;
    }

    const ids = withdrawalState.requests.map(
        (request) => request.id
    );

    const total = withdrawalState.requests.reduce(
        (sum, request) => sum + (Number(request.amount) || 0),
        0
    );

    openConfirmation({
        action,
        requestIds: ids,
        amount: total,
        isBulk: true,
        title: action === "approve"
            ? "Approve all pending requests?"
            : "Reject all pending requests?",
        description:
            `You are about to ${action} ${ids.length} pending withdrawal request(s), ` +
            `totalling ${formatMoney(total)}. Only requests that remain pending ` +
            `will be eligible. Continue?`,
        confirmLabel: action === "approve" ? "Approve All" : "Reject All"
    });
}

/* =========================================
   CONFIRMATION DIALOG
========================================= */

function initializeConfirmationDialog() {
    const dialog = document.getElementById("confirmDialog");

    document.getElementById("cancelAction").addEventListener("click", () => {
        if (!withdrawalState.actionInProgress) {
            dialog.close();
            withdrawalState.pendingDialogAction = null;
        }
    });

    document.getElementById("confirmAction").addEventListener(
        "click",
        executeConfirmedAction
    );

    dialog.addEventListener("cancel", (event) => {
        if (withdrawalState.actionInProgress) {
            event.preventDefault();
        } else {
            withdrawalState.pendingDialogAction = null;
        }
    });
}

function openConfirmation(details) {
    const dialog = document.getElementById("confirmDialog");
    const icon = document.getElementById("dialogIcon");
    const confirmButton = document.getElementById("confirmAction");

    withdrawalState.pendingDialogAction = details;

    document.getElementById("dialogTitle").textContent = details.title;
    document.getElementById("dialogDescription").textContent =
        details.description;

    confirmButton.textContent = details.confirmLabel;
    confirmButton.className = "dialog-confirm-button";

    icon.className = "dialog-icon";

    if (details.action === "reject") {
        icon.classList.add("danger");
        icon.innerHTML = '<i class="bx bx-x-circle"></i>';
        confirmButton.classList.add("danger");
    } else {
        icon.classList.add("success");
        icon.innerHTML = '<i class="bx bx-check-circle"></i>';
        confirmButton.classList.add("success");
    }

    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        showMessage(
            "Your browser does not support the confirmation dialog. Update your browser to continue.",
            "error"
        );
        withdrawalState.pendingDialogAction = null;
    }
}

async function executeConfirmedAction() {
    const details = withdrawalState.pendingDialogAction;

    if (!details || withdrawalState.actionInProgress) return;

    withdrawalState.actionInProgress = true;

    const dialog = document.getElementById("confirmDialog");
    const confirmButton = document.getElementById("confirmAction");
    const cancelButton = document.getElementById("cancelAction");

    confirmButton.disabled = true;
    cancelButton.disabled = true;
    confirmButton.textContent = "Processing...";

    try {
        if (details.isBulk) {
            await performBulkAction(details);
        } else {
            await performIndividualAction(details);
        }

        dialog.close();
        withdrawalState.pendingDialogAction = null;

    } catch (error) {
        document.getElementById("dialogDescription").textContent =
            error.message || "The action failed. Please try again.";

    } finally {
        withdrawalState.actionInProgress = false;
        confirmButton.disabled = false;
        cancelButton.disabled = false;

        if (withdrawalState.pendingDialogAction) {
            confirmButton.textContent =
                withdrawalState.pendingDialogAction.confirmLabel;
        }

        updatePendingControls();
    }
}

/* =========================================
   EXECUTE INDIVIDUAL ACTION
========================================= */

async function performIndividualAction(details) {
    const id = details.requestIds[0];

    if (!id) {
        throw new Error("The selected withdrawal request has no valid ID.");
    }

    withdrawalState.busyIds.add(id);
    showMessage("Processing withdrawal request...", "info");

    try {
        const response = await apiRequest(
            `/api/admin/withdrawals/requests/${encodeURIComponent(id)}/action`,
            {
                method: "POST",
                body: {
                    action: details.action
                }
            }
        );

        const result = await checkedJson(
            response,
            "The withdrawal request could not be processed."
        );

        if (result.success !== true) {
            throw new Error(
                "The server did not confirm the withdrawal action."
            );
        }

        showMessage(
            details.action === "approve"
                ? "The request was approved by the backend."
                : "The request was rejected by the backend.",
            "success"
        );

        await refreshAfterAction();

    } finally {
        withdrawalState.busyIds.delete(id);
    }
}

/* =========================================
   EXECUTE BULK ACTION
========================================= */

async function performBulkAction(details) {
    if (withdrawalState.bulkBusy) return;

    withdrawalState.bulkBusy = true;
    updatePendingControls();

    showMessage("Processing pending withdrawal requests...", "info");

    try {
        const response = await apiRequest(
            "/api/admin/withdrawals/bulk-action",
            {
                method: "POST",
                body: {
                    action: details.action,
                    requestIds: details.requestIds
                }
            }
        );

        const result = await checkedJson(
            response,
            "The bulk action could not be completed."
        );

        if (result.success !== true) {
            throw new Error(
                "The server did not confirm the bulk action."
            );
        }

        const processed = Number(result.processed);

        const skipped = Number(result.skipped);

        const summary =
            `Bulk action completed. ` +
            `${Number.isSafeInteger(processed) && processed >= 0 ? processed : 0} processed` +
            (Number.isSafeInteger(skipped) && skipped > 0
                ? `, ${skipped} skipped because they were no longer eligible.`
                : ".");

        showMessage(summary, "success");

        await refreshAfterAction();

    } finally {
        withdrawalState.bulkBusy = false;
        updatePendingControls();
    }
}

/* =========================================
   REFRESH AFTER ACTION
========================================= */

async function refreshAfterAction() {
    const results = await Promise.allSettled([
        loadSummary(),
        loadRequests()
    ]);

    if (results.some((result) => result.status === "rejected")) {
        showMessage(
            "The action was confirmed, but refreshing the latest data failed. Use Refresh to reload it.",
            "error"
        );
    }
}

/* =========================================
   GENERAL UI HELPERS
========================================= */

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function showMessage(message, type) {
    const element = document.getElementById("pageMessage");

    element.textContent = message;
    element.className = `page-message ${type}`;
    element.hidden = false;
}
