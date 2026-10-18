"use strict";

/* =========================================================
   KUDIX TRANSACTIONS
   Frontend transaction history interface

   No fake transactions are created.
   Connect loadTransactions() to your actual backend later.
========================================================= */

const TransactionPage = (() => {

    /* ================= CONFIGURATION ================= */

    const CONFIG = {
        pageSize: 8,

        /*
         * Keep null until your actual backend endpoint is available.
         *
         * Example when your backend is ready:
         * apiUrl: "/api/account/transactions"
         *
         * Your backend must authenticate the user and return
         * only records the current user is authorized to see.
         */

        apiUrl: null,

        /*
         * Optional integration point.
         *
         * You can define window.KUDIX_GET_TRANSACTIONS in your
         * authenticated application before this script runs.
         *
         * It must return an array of actual transaction records
         * or an object containing a transactions array.
         *
         * Do not use this integration to insert fabricated records.
         */

        getTransactions: null
    };


    /* ================= STATE ================= */

    let transactions = [];

    let filteredTransactions = [];

    let currentPage = 1;

    let isLoading = false;

    let hasLoaded = false;

    let loadFailed = false;

    let activeTransaction = null;

    let previousFocusedElement = null;

    let toastTimeouts = new Set();


    /* ================= ELEMENTS ================= */

    const elements = {};

    function cacheElements() {

        const ids = [
            "sidebar",
            "sidebarOverlay",
            "sidebarClose",
            "menuToggle",
            "themeToggle",
            "themeIcon",

            "transactionSearch",
            "clearSearch",
            "typeFilter",
            "statusFilter",

            "filterToggle",
            "advancedFilters",
            "dateFrom",
            "dateTo",
            "applyDateFilter",

            "filterSummary",
            "filterSummaryText",
            "clearFilters",

            "totalTransactions",
            "successfulTransactions",
            "pendingTransactions",
            "failedTransactions",
            "totalCaption",

            "recordCount",
            "loadingState",
            "errorState",
            "errorMessage",
            "retryButton",

            "emptyState",
            "emptyTitle",
            "emptyDescription",

            "tableContainer",
            "transactionTableBody",
            "noResults",
            "tableFooter",
            "paginationInfo",
            "previousPage",
            "nextPage",
            "currentPage",

            "exportButton",

            "transactionModal",
            "modalClose",
            "modalDone",
            "modalAmount",
            "modalStatus",
            "modalDetailsList",
            "modalTransactionIcon",
            "copyTransactionId",

            "toastContainer",
            "footerYear",
            "resetSearch"
        ];

        ids.forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }


    /* ================= HELPERS ================= */

    function escapeHTML(value) {

        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character]
        );
    }


    function normalizeText(value) {

        return String(value ?? "")
            .trim()
            .toLowerCase();
    }


    function normalizeStatus(status) {

        const normalized = normalizeText(status);

        const allowed = [
            "successful",
            "pending",
            "failed",
            "reversed"
        ];

        return allowed.includes(normalized)
            ? normalized
            : "unknown";
    }


    function normalizeType(type) {

        const normalized = normalizeText(type);

        const allowed = [
            "social_reward",
            "referral_reward",
            "promotional_credit",
            "deposit",
            "withdrawal",
            "game_activity"
        ];

        return allowed.includes(normalized)
            ? normalized
            : "other";
    }


    function formatCurrency(amount, currency = "NGN") {

        const numericAmount = Number(amount);

        if (!Number.isFinite(numericAmount)) {
            return "Not available";
        }

        const safeCurrency = /^[A-Z]{3}$/.test(currency)
            ? currency
            : "NGN";

        try {

            return new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: safeCurrency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(numericAmount);

        } catch {

            return `${safeCurrency} ${numericAmount.toFixed(2)}`;
        }
    }


    function formatDate(dateValue) {

        if (!dateValue) {
            return "Not available";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return new Intl.DateTimeFormat("en-NG", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }


    function formatTime(dateValue) {

        if (!dateValue) {
            return "Not available";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return new Intl.DateTimeFormat("en-NG", {
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }


    function formatType(type) {

        const labels = {
            social_reward: "Social Task Reward",
            referral_reward: "Referral Reward",
            promotional_credit: "Promotional Credit",
            deposit: "Deposit",
            withdrawal: "Withdrawal",
            game_activity: "Game Activity",
            other: "Other"
        };

        return labels[normalizeType(type)] || "Other";
    }


    function formatStatus(status) {

        const labels = {
            successful: "Successful",
            pending: "Pending",
            failed: "Failed",
            reversed: "Reversed",
            unknown: "Unavailable"
        };

        return labels[normalizeStatus(status)] || "Unavailable";
    }


    function getStatusIcon(status) {

        const icons = {
            successful: "bx-check-circle",
            pending: "bx-time-five",
            failed: "bx-x-circle",
            reversed: "bx-revision",
            unknown: "bx-help-circle"
        };

        return icons[normalizeStatus(status)] || "bx-help-circle";
    }


    function getStatusClass(status) {

        const classes = {
            successful: "status-successful",
            pending: "status-pending",
            failed: "status-failed",
            reversed: "status-reversed",
            unknown: ""
        };

        return classes[normalizeStatus(status)] || "";
    }


    function getTypeIcon(type) {

        const icons = {
            social_reward: "bx-share-alt",
            referral_reward: "bx-user-plus",
            promotional_credit: "bx-gift",
            deposit: "bx-wallet",
            withdrawal: "bx-money-withdraw",
            game_activity: "bx-joystick",
            other: "bx-transfer-alt"
        };

        return icons[normalizeType(type)] || "bx-transfer-alt";
    }


    function getDirection(transaction) {

        const explicitDirection = normalizeText(
            transaction.direction
        );

        if (
            explicitDirection === "incoming" ||
            explicitDirection === "outgoing"
        ) {
            return explicitDirection;
        }

        const type = normalizeType(transaction.type);

        if (
            type === "withdrawal" ||
            type === "game_activity"
        ) {
            return "outgoing";
        }

        if (
            type === "social_reward" ||
            type === "referral_reward" ||
            type === "deposit" ||
            type === "promotional_credit"
        ) {
            return "incoming";
        }

        return "neutral";
    }


    function formatTransactionAmount(transaction) {

        const amount = Number(transaction.amount);

        if (!Number.isFinite(amount)) {
            return "Not available";
        }

        const direction = getDirection(transaction);

        const formatted = formatCurrency(
            Math.abs(amount),
            transaction.currency || "NGN"
        );

        if (direction === "incoming") {
            return `+ ${formatted}`;
        }

        if (direction === "outgoing") {
            return `− ${formatted}`;
        }

        return formatted;
    }


    function getPaymentMethod(transaction) {

        const method = String(
            transaction.paymentMethod ||
            transaction.payment_method ||
            ""
        ).trim();

        return method || "Not available";
    }


    function getDescription(transaction) {

        const description = String(
            transaction.description || ""
        ).trim();

        return description || formatType(transaction.type);
    }


    function getTransactionId(transaction) {

        return String(
            transaction.id ||
            transaction.transactionId ||
            transaction.transaction_id ||
            ""
        ).trim();
    }


    function validTransactionDate(transaction) {

        const value =
            transaction.createdAt ||
            transaction.created_at ||
            transaction.date;

        if (!value) {
            return null;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }


    /* ================= TOASTS ================= */

    function showToast(message, type = "success") {

        if (!elements.toastContainer) {
            return;
        }

        const toast = document.createElement("div");

        toast.className = `toast ${type === "error" ? "toast-error" : ""
            }`;

        const icon = type === "error"
            ? "bx-error-circle"
            : "bx-check-circle";

        const title = type === "error"
            ? "Something went wrong"
            : "Notice";

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="bx ${icon}"></i>
            </div>

            <div>
                <strong>${title}</strong>
                <p>${escapeHTML(message)}</p>
            </div>
        `;

        elements.toastContainer.appendChild(toast);

        const timeout = window.setTimeout(() => {

            toast.remove();

            toastTimeouts.delete(timeout);

        }, 4000);

        toastTimeouts.add(timeout);
    }


    /* ================= THEME ================= */

    function applyTheme(theme) {

        const dark = theme === "dark";

        document.body.classList.toggle("dark-theme", dark);

        if (elements.themeIcon) {

            elements.themeIcon.className = dark
                ? "bx bx-sun"
                : "bx bx-moon";
        }

        if (elements.themeToggle) {

            const label = dark
                ? "Switch to light theme"
                : "Switch to dark theme";

            elements.themeToggle.setAttribute(
                "aria-label",
                label
            );

            elements.themeToggle.title = label;
        }

        const metaTheme = document.querySelector(
            'meta[name="theme-color"]'
        );

        if (metaTheme) {

            metaTheme.content = dark
                ? "#080D19"
                : "#F5F7FC";
        }
    }


    function initializeTheme() {

        let savedTheme = null;

        try {
            savedTheme = localStorage.getItem("kudix-theme");
        } catch {
            savedTheme = null;
        }

        if (
            savedTheme !== "dark" &&
            savedTheme !== "light"
        ) {

            savedTheme = window.matchMedia &&
                window.matchMedia(
                    "(prefers-color-scheme: dark)"
                ).matches
                ? "dark"
                : "light";
        }

        applyTheme(savedTheme);
    }


    function toggleTheme() {

        const currentlyDark = document.body.classList.contains(
            "dark-theme"
        );

        const nextTheme = currentlyDark
            ? "light"
            : "dark";

        applyTheme(nextTheme);

        try {

            localStorage.setItem(
                "kudix-theme",
                nextTheme
            );

        } catch {
            // Theme still works for this page session.
        }
    }


    /* ================= MOBILE SIDEBAR ================= */

    function openSidebar() {

        elements.sidebar?.classList.add("open");

        elements.sidebarOverlay?.classList.add("visible");

        elements.menuToggle?.setAttribute(
            "aria-expanded",
            "true"
        );

        document.body.style.overflow = "hidden";
    }


    function closeSidebar() {

        elements.sidebar?.classList.remove("open");

        elements.sidebarOverlay?.classList.remove("visible");

        elements.menuToggle?.setAttribute(
            "aria-expanded",
            "false"
        );

        document.body.style.overflow = "";
    }


    function initializeSidebar() {

        elements.menuToggle?.addEventListener(
            "click",
            openSidebar
        );

        elements.sidebarClose?.addEventListener(
            "click",
            closeSidebar
        );

        elements.sidebarOverlay?.addEventListener(
            "click",
            closeSidebar
        );

        elements.sidebar
            ?.querySelectorAll(".nav-item")
            .forEach(link => {

                link.addEventListener("click", closeSidebar);
            });

        window.addEventListener("resize", () => {

            if (window.innerWidth > 900) {
                closeSidebar();
            }
        });
    }


    /* ================= TRANSACTION VALIDATION ================= */

    function normalizeTransaction(raw) {

        if (
            !raw ||
            typeof raw !== "object" ||
            Array.isArray(raw)
        ) {
            return null;
        }

        const id = getTransactionId(raw);

        /*
         * A real transaction must have an identifiable ID.
         * Do not generate a fake one for display.
         */

        if (!id) {
            return null;
        }

        const amount = Number(raw.amount);

        if (!Number.isFinite(amount)) {
            return null;
        }

        const date = validTransactionDate(raw);

        return {
            id,

            description: getDescription(raw),

            type: normalizeType(raw.type),

            amount,

            currency: /^[A-Z]{3}$/.test(
                String(raw.currency || "NGN")
            )
                ? String(raw.currency || "NGN")
                : "NGN",

            date: date ? date.toISOString() : null,

            paymentMethod: getPaymentMethod(raw),

            status: normalizeStatus(raw.status),

            direction: getDirection(raw),

            reference:
                raw.reference ||
                raw.referenceId ||
                raw.reference_id ||
                "",

            metadata:
                raw.metadata &&
                    typeof raw.metadata === "object"
                    ? raw.metadata
                    : {}
        };
    }


    /* ================= DATA LOADING ================= */

    async function fetchTransactions() {

        /*
         * Preferred integration:
         *
         * Define an authenticated application function:
         *
         * window.KUDIX_GET_TRANSACTIONS = async () => {
         *     return await yourExistingApiFunction();
         * };
         *
         * It should return either:
         *
         * [
         *   {
         *     id: "actual-transaction-id",
         *     description: "Actual description",
         *     type: "social_reward",
         *     amount: 1000,
         *     currency: "NGN",
         *     status: "successful",
         *     direction: "incoming",
         *     createdAt: "2026-10-17T08:00:00Z",
         *     paymentMethod: "Account Credit"
         *   }
         * ]
         *
         * OR:
         *
         * { transactions: [...] }
         *
         * Only return records from your real backend.
         */

        const provider =
            CONFIG.getTransactions ||
            window.KUDIX_GET_TRANSACTIONS;

        if (typeof provider === "function") {

            const result = await provider();

            if (Array.isArray(result)) {
                return result;
            }

            if (
                result &&
                Array.isArray(result.transactions)
            ) {
                return result.transactions;
            }

            throw new Error(
                "The transaction provider returned an invalid response."
            );
        }


        /*
         * Optional REST API integration.
         *
         * Configure CONFIG.apiUrl in this file only when
         * your real backend endpoint is ready.
         */

        if (CONFIG.apiUrl) {

            const response = await fetch(
                CONFIG.apiUrl,
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!response.ok) {

                throw new Error(
                    `Transaction request failed (${response.status}).`
                );
            }

            const result = await response.json();

            if (Array.isArray(result)) {
                return result;
            }

            if (
                result &&
                Array.isArray(result.transactions)
            ) {
                return result.transactions;
            }

            throw new Error(
                "The transaction API returned an invalid response."
            );
        }


        /*
         * No real data source has been configured.
         * Return an empty array rather than inventing records.
         */

        return [];
    }


    async function loadTransactions() {

        if (isLoading) {
            return;
        }

        isLoading = true;
        loadFailed = false;

        showOnlyState("loading");

        if (elements.errorMessage) {
            elements.errorMessage.textContent =
                "We couldn't retrieve your transaction records.";
        }

        try {

            const rawTransactions = await fetchTransactions();

            if (!Array.isArray(rawTransactions)) {

                throw new Error(
                    "Transaction data must be an array."
                );
            }

            transactions = rawTransactions
                .map(normalizeTransaction)
                .filter(Boolean);

            /*
             * A malformed record is excluded instead of being
             * converted into a fictional transaction.
             */

            transactions.sort((a, b) => {

                const dateA = a.date
                    ? new Date(a.date).getTime()
                    : 0;

                const dateB = b.date
                    ? new Date(b.date).getTime()
                    : 0;

                return dateB - dateA;
            });

            hasLoaded = true;
            loadFailed = false;

            updateSummary();

            applyFilters();

        } catch (error) {

            console.error(
                "KUDIX transaction loading error:",
                error
            );

            loadFailed = true;

            showOnlyState("error");

            if (elements.errorMessage) {

                elements.errorMessage.textContent =
                    "Your transaction records could not be loaded. Please try again.";
            }

        } finally {

            isLoading = false;
        }
    }


    /* ================= SUMMARY ================= */

    function updateSummary() {

        const total = transactions.length;

        const successful = transactions.filter(
            transaction =>
                transaction.status === "successful"
        ).length;

        const pending = transactions.filter(
            transaction =>
                transaction.status === "pending"
        ).length;

        const failed = transactions.filter(
            transaction =>
                transaction.status === "failed" ||
                transaction.status === "reversed"
        ).length;

        elements.totalTransactions.textContent = total;

        elements.successfulTransactions.textContent =
            successful;

        elements.pendingTransactions.textContent =
            pending;

        elements.failedTransactions.textContent =
            failed;

        if (elements.totalCaption) {

            elements.totalCaption.textContent = total === 1
                ? "1 available record"
                : `${total} available records`;
        }
    }


    /* ================= UI STATES ================= */

    function showOnlyState(state) {

        const stateElements = [
            "loadingState",
            "errorState",
            "emptyState",
            "tableContainer",
            "noResults",
            "tableFooter"
        ];

        stateElements.forEach(key => {

            if (elements[key]) {
                elements[key].hidden = true;
            }
        });

        if (elements.filterSummary) {
            elements.filterSummary.hidden = true;
        }

        if (elements.recordCount) {
            elements.recordCount.textContent = "0 records";
        }

        if (state === "loading") {

            elements.loadingState.hidden = false;

        } else if (state === "error") {

            elements.errorState.hidden = false;

        } else if (state === "empty") {

            elements.emptyState.hidden = false;

            elements.emptyTitle.textContent =
                "No transactions yet";

            elements.emptyDescription.textContent =
                "Your account activity will appear here when transaction records become available.";

        } else if (state === "filtered-empty") {

            elements.noResults.hidden = false;

        } else if (state === "table") {

            elements.tableContainer.hidden = false;

            elements.tableFooter.hidden = false;
        }
    }


    /* ================= FILTERS ================= */

    function getFilterValues() {

        return {
            search: normalizeText(
                elements.transactionSearch.value
            ),

            type: elements.typeFilter.value,

            status: elements.statusFilter.value,

            dateFrom: elements.dateFrom.value,

            dateTo: elements.dateTo.value
        };
    }


    function getFilterDescriptions(filters) {

        const descriptions = [];

        if (filters.search) {
            descriptions.push(
                `Search: "${filters.search}"`
            );
        }

        if (filters.type !== "all") {
            descriptions.push(
                `Type: ${formatType(filters.type)}`
            );
        }

        if (filters.status !== "all") {
            descriptions.push(
                `Status: ${formatStatus(filters.status)}`
            );
        }

        if (filters.dateFrom) {
            descriptions.push(
                `From: ${filters.dateFrom}`
            );
        }

        if (filters.dateTo) {
            descriptions.push(
                `To: ${filters.dateTo}`
            );
        }

        return descriptions;
    }


    function applyFilters() {

        if (!hasLoaded || loadFailed) {
            return;
        }

        const filters = getFilterValues();

        const fromDate = filters.dateFrom
            ? new Date(
                `${filters.dateFrom}T00:00:00`
            )
            : null;

        const toDate = filters.dateTo
            ? new Date(
                `${filters.dateTo}T23:59:59.999`
            )
            : null;


        filteredTransactions = transactions.filter(
            transaction => {

                const searchableText = [
                    transaction.id,
                    transaction.description,
                    formatType(transaction.type),
                    transaction.reference,
                    transaction.paymentMethod
                ]
                    .join(" ")
                    .toLowerCase();

                if (
                    filters.search &&
                    !searchableText.includes(filters.search)
                ) {
                    return false;
                }

                if (
                    filters.type !== "all" &&
                    transaction.type !== filters.type
                ) {
                    return false;
                }

                if (
                    filters.status !== "all" &&
                    transaction.status !== filters.status
                ) {
                    return false;
                }

                const transactionDate = transaction.date
                    ? new Date(transaction.date)
                    : null;

                if (fromDate) {

                    if (
                        !transactionDate ||
                        transactionDate < fromDate
                    ) {
                        return false;
                    }
                }

                if (toDate) {

                    if (
                        !transactionDate ||
                        transactionDate > toDate
                    ) {
                        return false;
                    }
                }

                return true;
            }
        );


        currentPage = 1;

        renderCurrentState();

        updateFilterSummary();
    }


    function updateFilterSummary() {

        const filters = getFilterValues();

        const descriptions = getFilterDescriptions(filters);

        const hasActiveFilters = descriptions.length > 0;

        elements.filterSummary.hidden = !hasActiveFilters;

        elements.clearSearch.hidden = !filters.search;

        if (hasActiveFilters) {

            elements.filterSummaryText.textContent =
                descriptions.join(" · ");
        }
    }


    function clearAllFilters() {

        elements.transactionSearch.value = "";

        elements.typeFilter.value = "all";

        elements.statusFilter.value = "all";

        elements.dateFrom.value = "";

        elements.dateTo.value = "";

        elements.clearSearch.hidden = true;

        applyFilters();
    }


    function handleDateFilter() {

        const from = elements.dateFrom.value;

        const to = elements.dateTo.value;

        if (from && to && from > to) {

            showToast(
                "The start date cannot be later than the end date.",
                "error"
            );

            return;
        }

        applyFilters();
    }


    /* ================= RENDERING ================= */

    function renderCurrentState() {

        if (!transactions.length) {

            showOnlyState("empty");

            elements.recordCount.textContent = "0 records";

            elements.exportButton.disabled = true;

            return;
        }

        if (!filteredTransactions.length) {

            showOnlyState("filtered-empty");

            elements.recordCount.textContent = "0 matching records";

            elements.exportButton.disabled = true;

            return;
        }

        elements.recordCount.textContent =
            `${filteredTransactions.length} ${filteredTransactions.length === 1
                ? "record"
                : "records"
            }`;

        elements.exportButton.disabled = false;

        renderTable();

        showOnlyState("table");
    }


    function renderTable() {

        const startIndex =
            (currentPage - 1) * CONFIG.pageSize;

        const pageRecords = filteredTransactions.slice(
            startIndex,
            startIndex + CONFIG.pageSize
        );

        elements.transactionTableBody.innerHTML =
            pageRecords.map(renderTransactionRow).join("");

        updatePagination();
    }


    function renderTransactionRow(transaction) {

        const direction = transaction.direction;

        const directionClass =
            direction === "incoming"
                ? "incoming"
                : direction === "outgoing"
                    ? "outgoing"
                    : "neutral";

        const status = transaction.status;

        const statusClass = getStatusClass(status);

        const date = transaction.date;

        const transactionId = transaction.id;

        const shortId = transactionId.length > 18
            ? `${transactionId.slice(0, 9)}…${transactionId.slice(-5)}`
            : transactionId;

        const paymentMethod = getPaymentMethod(transaction);

        const dateText = date
            ? formatDate(date)
            : "Not available";

        const timeText = date
            ? formatTime(date)
            : "Not available";

        return `
            <tr>

                <td>
                    <div class="transaction-cell">

                        <div class="transaction-row-icon ${directionClass}">
                            <i class="bx ${getTypeIcon(transaction.type)}"></i>
                        </div>

                        <div class="transaction-main">

                            <strong>
                                ${escapeHTML(transaction.description)}
                            </strong>

                            <small title="${escapeHTML(transactionId)}">
                                ${escapeHTML(shortId)}
                            </small>

                        </div>

                    </div>
                </td>


                <td>
                    <span class="transaction-type">
                        <i class="bx ${getTypeIcon(transaction.type)}"></i>
                        ${escapeHTML(formatType(transaction.type))}
                    </span>
                </td>


                <td>
                    <span class="amount ${directionClass}">
                        ${escapeHTML(formatTransactionAmount(transaction))}
                    </span>
                </td>


                <td>
                    <div class="transaction-date">

                        <strong>
                            ${escapeHTML(dateText)}
                        </strong>

                        <small>
                            ${escapeHTML(timeText)}
                        </small>

                    </div>
                </td>


                <td>
                    <span class="payment-method">
                        <i class="bx bx-wallet"></i>
                        ${escapeHTML(paymentMethod)}
                    </span>
                </td>


                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="bx ${getStatusIcon(status)}"></i>
                        ${escapeHTML(formatStatus(status))}
                    </span>
                </td>


                <td>
                    <button
                        type="button"
                        class="view-transaction"
                        data-transaction-id="${escapeHTML(transactionId)}"
                        aria-label="View details for ${escapeHTML(transactionId)}"
                        title="View transaction details"
                    >
                        <i class="bx bx-show-alt"></i>
                    </button>
                </td>

            </tr>
        `;
    }


    function updatePagination() {

        const total = filteredTransactions.length;

        const totalPages = Math.max(
            1,
            Math.ceil(total / CONFIG.pageSize)
        );

        currentPage = Math.min(
            Math.max(currentPage, 1),
            totalPages
        );

        const start = total === 0
            ? 0
            : ((currentPage - 1) * CONFIG.pageSize) + 1;

        const end = Math.min(
            currentPage * CONFIG.pageSize,
            total
        );

        elements.paginationInfo.textContent =
            `Showing ${start}–${end} of ${total} records`;

        elements.currentPage.textContent = currentPage;

        elements.previousPage.disabled =
            currentPage <= 1;

        elements.nextPage.disabled =
            currentPage >= totalPages;
    }


    /* ================= TRANSACTION DETAILS ================= */

    function openTransactionDetails(transactionId) {

        const transaction = transactions.find(
            item => item.id === transactionId
        );

        if (!transaction) {

            showToast(
                "This transaction could not be found.",
                "error"
            );

            return;
        }

        activeTransaction = transaction;

        previousFocusedElement = document.activeElement;

        const direction = transaction.direction;

        elements.modalAmount.textContent =
            formatTransactionAmount(transaction);

        elements.modalTransactionIcon.innerHTML =
            `<i class="bx ${getTypeIcon(transaction.type)}"></i>`;

        elements.modalStatus.innerHTML = `
            <span class="status-badge ${getStatusClass(transaction.status)}">
                <i class="bx ${getStatusIcon(transaction.status)}"></i>
                ${escapeHTML(formatStatus(transaction.status))}
            </span>
        `;


        const details = [
            {
                label: "Transaction ID",
                value: transaction.id
            },
            {
                label: "Description",
                value: transaction.description
            },
            {
                label: "Transaction Type",
                value: formatType(transaction.type)
            },
            {
                label: "Date",
                value: transaction.date
                    ? formatDate(transaction.date)
                    : "Not available"
            },
            {
                label: "Time",
                value: transaction.date
                    ? formatTime(transaction.date)
                    : "Not available"
            },
            {
                label: "Payment Method",
                value: getPaymentMethod(transaction)
            },
            {
                label: "Reference",
                value: transaction.reference || "Not available"
            },
            {
                label: "Direction",
                value: direction === "incoming"
                    ? "Incoming"
                    : direction === "outgoing"
                        ? "Outgoing"
                        : "Not specified"
            }
        ];


        elements.modalDetailsList.innerHTML =
            details.map(detail => `
                <div class="modal-detail-row">

                    <span class="modal-detail-label">
                        ${escapeHTML(detail.label)}
                    </span>

                    <span class="modal-detail-value">
                        ${escapeHTML(detail.value)}
                    </span>

                </div>
            `).join("");


        elements.transactionModal.hidden = false;

        elements.transactionModal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.style.overflow = "hidden";

        elements.modalClose.focus();
    }


    function closeTransactionDetails() {

        if (elements.transactionModal.hidden) {
            return;
        }

        elements.transactionModal.hidden = true;

        elements.transactionModal.setAttribute(
            "aria-hidden",
            "true"
        );

        activeTransaction = null;

        document.body.style.overflow = "";

        if (
            previousFocusedElement &&
            typeof previousFocusedElement.focus === "function"
        ) {
            previousFocusedElement.focus();
        }
    }


    async function copyTransactionId() {

        if (!activeTransaction) {
            return;
        }

        const transactionId = activeTransaction.id;

        try {

            if (
                navigator.clipboard &&
                window.isSecureContext
            ) {

                await navigator.clipboard.writeText(
                    transactionId
                );

            } else {

                const temporaryInput =
                    document.createElement("textarea");

                temporaryInput.value = transactionId;

                temporaryInput.setAttribute("readonly", "");

                temporaryInput.style.position = "fixed";

                temporaryInput.style.opacity = "0";

                document.body.appendChild(temporaryInput);

                temporaryInput.select();

                const copied = document.execCommand("copy");

                temporaryInput.remove();

                if (!copied) {
                    throw new Error("Copy operation failed.");
                }
            }

            showToast("Transaction ID copied.");

        } catch {

            showToast(
                "Unable to copy automatically. Please select the transaction ID manually.",
                "error"
            );
        }
    }


    /* ================= CSV EXPORT ================= */

    function csvEscape(value) {

        const textValue = String(value ?? "");

        /*
         * Prevent spreadsheet formula injection when exporting
         * values that begin with formula characters.
         */

        const safeValue = /^[\s]*[=+\-@]/.test(textValue)
            ? `'${textValue}`
            : textValue;

        return `"${safeValue.replace(/"/g, '""')}"`;
    }


    function exportTransactions() {

        if (
            !Array.isArray(filteredTransactions) ||
            filteredTransactions.length === 0
        ) {

            showToast(
                "There are no transaction records to export.",
                "error"
            );

            return;
        }


        const headers = [
            "Transaction ID",
            "Description",
            "Type",
            "Amount",
            "Currency",
            "Date",
            "Payment Method",
            "Status",
            "Reference"
        ];


        const rows = filteredTransactions.map(
            transaction => [

                transaction.id,

                transaction.description,

                formatType(transaction.type),

                transaction.amount,

                transaction.currency,

                transaction.date || "",

                getPaymentMethod(transaction),

                formatStatus(transaction.status),

                transaction.reference || ""

            ]
        );


        const csvContent = [
            headers,
            ...rows
        ]
            .map(row =>
                row.map(csvEscape).join(",")
            )
            .join("\r\n");


        const blob = new Blob(
            ["\uFEFF", csvContent],
            {
                type: "text/csv;charset=utf-8;"
            }
        );

        const objectURL = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = objectURL;

        link.download =
            `kudix-transactions-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        window.setTimeout(() => {

            URL.revokeObjectURL(objectURL);

        }, 1000);

        showToast("Your transaction CSV has been exported.");
    }


    /* ================= EVENT LISTENERS ================= */

    function initializeFilters() {

        elements.transactionSearch.addEventListener(
            "input",
            applyFilters
        );

        elements.typeFilter.addEventListener(
            "change",
            applyFilters
        );

        elements.statusFilter.addEventListener(
            "change",
            applyFilters
        );

        elements.clearSearch.addEventListener(
            "click",
            () => {

                elements.transactionSearch.value = "";

                applyFilters();

                elements.transactionSearch.focus();
            }
        );

        elements.filterToggle.addEventListener(
            "click",
            () => {

                const isOpen =
                    !elements.advancedFilters.hidden;

                elements.advancedFilters.hidden = isOpen;

                elements.filterToggle.setAttribute(
                    "aria-expanded",
                    String(!isOpen)
                );
            }
        );

        elements.applyDateFilter.addEventListener(
            "click",
            handleDateFilter
        );

        elements.clearFilters.addEventListener(
            "click",
            clearAllFilters
        );

        elements.resetSearch.addEventListener(
            "click",
            clearAllFilters
        );

        elements.previousPage.addEventListener(
            "click",
            () => {

                if (currentPage > 1) {

                    currentPage--;

                    renderTable();

                    showOnlyState("table");
                }
            }
        );

        elements.nextPage.addEventListener(
            "click",
            () => {

                const totalPages = Math.ceil(
                    filteredTransactions.length /
                    CONFIG.pageSize
                );

                if (currentPage < totalPages) {

                    currentPage++;

                    renderTable();

                    showOnlyState("table");
                }
            }
        );
    }


    function initializeModal() {

        elements.transactionTableBody.addEventListener(
            "click",
            event => {

                const button = event.target.closest(
                    "[data-transaction-id]"
                );

                if (!button) {
                    return;
                }

                openTransactionDetails(
                    button.dataset.transactionId
                );
            }
        );


        elements.modalClose.addEventListener(
            "click",
            closeTransactionDetails
        );

        elements.modalDone.addEventListener(
            "click",
            closeTransactionDetails
        );

        elements.copyTransactionId.addEventListener(
            "click",
            copyTransactionId
        );


        elements.transactionModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    elements.transactionModal
                ) {
                    closeTransactionDetails();
                }
            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape" &&
                    !elements.transactionModal.hidden
                ) {

                    closeTransactionDetails();

                    return;
                }

                if (
                    event.key === "Escape" &&
                    elements.sidebar.classList.contains("open")
                ) {

                    closeSidebar();
                }
            }
        );
    }


    /* ================= INITIALIZATION ================= */

    function initialize() {

        cacheElements();

        initializeTheme();

        initializeSidebar();

        initializeFilters();

        initializeModal();


        elements.themeToggle.addEventListener(
            "click",
            toggleTheme
        );

        elements.exportButton.addEventListener(
            "click",
            exportTransactions
        );

        elements.retryButton.addEventListener(
            "click",
            loadTransactions
        );


        if (elements.footerYear) {

            elements.footerYear.textContent =
                new Date().getFullYear();
        }


        /*
         * Initially show the empty state.
         * loadTransactions() will replace it with the correct
         * state when a backend or provider is configured.
         */

        showOnlyState("empty");

        elements.exportButton.disabled = true;

        loadTransactions();
    }


    return {
        initialize,
        loadTransactions
    };

})();


/* Initialize after the document is ready. */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        TransactionPage.initialize
    );

} else {

    TransactionPage.initialize();
}