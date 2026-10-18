"use strict";

/*
|--------------------------------------------------------------------------
| KUDIX WALLET FRONTEND
|--------------------------------------------------------------------------
| This file manages the wallet interface only.
|
| IMPORTANT:
| - No real financial operations are performed here.
| - No balances or transactions are fabricated.
| - Connect the functions below to your real backend before enabling
|   deposits, withdrawals, or account balance updates.
|--------------------------------------------------------------------------
*/

const WalletApp = (() => {

    /*
    |--------------------------------------------------------------------------
    | CONFIGURATION
    |--------------------------------------------------------------------------
    */

    const CONFIG = {
        currency: "NGN",
        locale: "en-NG",
        transactionPageSize: 10,

        /*
         * Set this to true only after a real backend is connected,
         * server-side validation is implemented, and the backend is
         * ready to receive the corresponding requests.
         */
        financialActionsEnabled: false,

        /*
         * Populate these lists from the backend when payment providers
         * and withdrawal methods have been configured.
         */
        depositMethods: [],
        withdrawalMethods: []
    };

    /*
    |--------------------------------------------------------------------------
    | STATE
    |--------------------------------------------------------------------------
    */

    const state = {
        balanceVisible: true,
        actionType: null,

        wallet: null,
        transactions: [],

        visibleTransactionCount: CONFIG.transactionPageSize,

        searchTerm: "",
        typeFilter: "all",
        statusFilter: "all"
    };

    const elements = {};

    /*
    |--------------------------------------------------------------------------
    | DOM HELPERS
    |--------------------------------------------------------------------------
    */

    function getElement(id) {
        return document.getElementById(id);
    }

    function cacheElements() {
        [
            "sidebar",
            "sidebarOverlay",
            "sidebarClose",
            "mobileMenuBtn",
            "themeToggle",

            "balanceVisibility",
            "availableBalance",
            "pendingBalance",
            "totalRewards",
            "walletStatus",

            "refreshWallet",
            "openDeposit",
            "openWithdraw",

            "transactionSearch",
            "typeFilter",
            "statusFilter",
            "transactionTableBody",
            "emptyState",
            "noResults",
            "transactionCount",
            "loadMore",

            "walletReference",
            "copyWalletReference",
            "verificationStatus",
            "walletCreatedAt",

            "walletModal",
            "closeModal",
            "modalIcon",
            "modalTitle",
            "modalDescription",
            "modalNoticeText",

            "walletActionForm",
            "transactionAmount",
            "paymentMethod",
            "destinationGroup",
            "destinationDetails",
            "formError",
            "submitWalletAction",

            "toast",
            "toastMessage",
            "currentYear"
        ].forEach(id => {
            elements[id] = getElement(id);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | TOAST NOTIFICATIONS
    |--------------------------------------------------------------------------
    */

    let toastTimer = null;

    function showToast(message, type = "info") {
        if (!elements.toast || !elements.toastMessage) return;

        const icon = elements.toast.querySelector("i");

        const icons = {
            info: "bx-info-circle",
            success: "bx-check-circle",
            error: "bx-error-circle"
        };

        if (icon) {
            icon.className = `bx ${icons[type] || icons.info}`;
        }

        elements.toastMessage.textContent = message;
        elements.toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            elements.toast.classList.remove("show");
        }, 3500);
    }

    /*
    |--------------------------------------------------------------------------
    | THEME
    |--------------------------------------------------------------------------
    */

    function initializeTheme() {
        let savedTheme = null;

        try {
            savedTheme = localStorage.getItem("kudix-theme");
        } catch (error) {
            // Continue with the default theme if storage is unavailable.
        }

        if (savedTheme === "dark") {
            document.body.classList.add("dark-mode");
        }

        updateThemeIcon();
    }

    function updateThemeIcon() {
        if (!elements.themeToggle) return;

        const icon = elements.themeToggle.querySelector("i");

        if (!icon) return;

        icon.className = document.body.classList.contains("dark-mode")
            ? "bx bx-sun"
            : "bx bx-moon";
    }

    function toggleTheme() {
        document.body.classList.toggle("dark-mode");

        const theme = document.body.classList.contains("dark-mode")
            ? "dark"
            : "light";

        try {
            localStorage.setItem("kudix-theme", theme);
        } catch (error) {
            // Theme still works for this page session.
        }

        updateThemeIcon();
    }

    /*
    |--------------------------------------------------------------------------
    | MOBILE SIDEBAR
    |--------------------------------------------------------------------------
    */

    function openSidebar() {
        elements.sidebar?.classList.add("open");
        elements.sidebarOverlay?.classList.add("show");

        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        elements.sidebar?.classList.remove("open");
        elements.sidebarOverlay?.classList.remove("show");

        document.body.style.overflow = "";
    }

    /*
    |--------------------------------------------------------------------------
    | CURRENCY FORMATTING
    |--------------------------------------------------------------------------
    */

    function formatCurrency(amount) {
        const number = Number(amount);

        if (!Number.isFinite(number)) {
            return "Unavailable";
        }

        return new Intl.NumberFormat(CONFIG.locale, {
            style: "currency",
            currency: CONFIG.currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(number);
    }

    function formatDate(dateValue) {
        if (!dateValue) return "Unavailable";

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Unavailable";
        }

        return new Intl.DateTimeFormat(CONFIG.locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    /*
    |--------------------------------------------------------------------------
    | BALANCE VISIBILITY
    |--------------------------------------------------------------------------
    */

    function toggleBalanceVisibility() {
        state.balanceVisible = !state.balanceVisible;

        const icon = elements.balanceVisibility?.querySelector("i");

        if (icon) {
            icon.className = state.balanceVisible
                ? "bx bx-show"
                : "bx bx-hide";
        }

        renderWallet();
    }

    /*
    |--------------------------------------------------------------------------
    | WALLET RENDERING
    |--------------------------------------------------------------------------
    */

    function renderWallet() {
        const wallet = state.wallet;

        if (!wallet) {
            elements.availableBalance.textContent = "Connect your wallet";
            elements.pendingBalance.textContent = "Unavailable";
            elements.totalRewards.textContent = "Unavailable";
            elements.walletStatus.textContent = "Not connected";

            elements.walletReference.textContent = "Not assigned";
            elements.verificationStatus.textContent = "Unavailable";
            elements.walletCreatedAt.textContent = "Unavailable";

            elements.copyWalletReference.disabled = true;

            return;
        }

        elements.availableBalance.textContent = state.balanceVisible
            ? formatCurrency(wallet.availableBalance)
            : "••••••••";

        elements.pendingBalance.textContent = state.balanceVisible
            ? formatCurrency(wallet.pendingBalance)
            : "••••••••";

        elements.totalRewards.textContent = state.balanceVisible
            ? formatCurrency(wallet.totalRewards)
            : "••••••••";

        elements.walletStatus.textContent = wallet.status || "Unavailable";

        elements.walletReference.textContent =
            wallet.reference || "Not assigned";

        elements.copyWalletReference.disabled = !wallet.reference;

        elements.verificationStatus.textContent =
            wallet.verificationStatus || "Unavailable";

        elements.walletCreatedAt.textContent =
            wallet.createdAt ? formatDate(wallet.createdAt) : "Unavailable";
    }

    /*
    |--------------------------------------------------------------------------
    | TRANSACTION HELPERS
    |--------------------------------------------------------------------------
    */

    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function getTransactionLabel(type) {
        const labels = {
            deposit: "Deposit",
            withdrawal: "Withdrawal",
            gaming: "Gaming rewards",
            social: "Social task rewards",
            referral: "Referral rewards",
            adjustment: "Wallet adjustment"
        };

        return labels[type] || "Wallet transaction";
    }

    function getTransactionIcon(type) {
        const icons = {
            deposit: "bx-plus-circle",
            withdrawal: "bx-arrow-from-bottom",
            gaming: "bx-joystick",
            social: "bx-share-alt",
            referral: "bx-user-plus",
            adjustment: "bx-transfer-alt"
        };

        return icons[type] || "bx-receipt";
    }

    function getStatusLabel(status) {
        const labels = {
            completed: "Completed",
            pending: "Pending",
            processing: "Processing",
            failed: "Failed"
        };

        return labels[status] || "Unavailable";
    }

    function getFilteredTransactions() {
        const search = normalize(state.searchTerm);

        return state.transactions.filter(transaction => {
            const matchesSearch =
                !search ||
                normalize(transaction.description).includes(search) ||
                normalize(transaction.reference).includes(search);

            const matchesType =
                state.typeFilter === "all" ||
                transaction.type === state.typeFilter;

            const matchesStatus =
                state.statusFilter === "all" ||
                transaction.status === state.statusFilter;

            return matchesSearch && matchesType && matchesStatus;
        });
    }

    /*
    |--------------------------------------------------------------------------
    | SAFE TRANSACTION RENDERING
    |--------------------------------------------------------------------------
    | All text is inserted through textContent or escaped before use.
    |--------------------------------------------------------------------------
    */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function renderTransactions() {
        const filtered = getFilteredTransactions();

        const visible = filtered.slice(
            0,
            state.visibleTransactionCount
        );

        elements.transactionTableBody.innerHTML = "";

        elements.emptyState.classList.toggle(
            "hidden",
            state.transactions.length > 0
        );

        elements.noResults.classList.toggle(
            "hidden",
            !(state.transactions.length > 0 && filtered.length === 0)
        );

        elements.transactionCount.textContent =
            `${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`;

        elements.loadMore.classList.toggle(
            "hidden",
            visible.length >= filtered.length || filtered.length === 0
        );

        visible.forEach(transaction => {
            const row = document.createElement("tr");

            const amount = Number(transaction.amount);
            const validAmount = Number.isFinite(amount);

            const isPositive =
                transaction.direction === "credit" ||
                ["deposit", "gaming", "social", "referral"].includes(transaction.type);

            const amountClass = isPositive ? "positive" : "negative";

            const amountText = validAmount
                ? `${isPositive ? "+" : "−"}${formatCurrency(Math.abs(amount))}`
                : "Unavailable";

            const status = [
                "completed",
                "pending",
                "processing",
                "failed"
            ].includes(transaction.status)
                ? transaction.status
                : "pending";

            row.innerHTML = `
                <td>
                    <div class="transaction-name">
                        <div class="transaction-type-icon ${escapeHTML(transaction.type)}">
                            <i class="bx ${getTransactionIcon(transaction.type)}"></i>
                        </div>

                        <div>
                            <strong>${escapeHTML(transaction.description || getTransactionLabel(transaction.type))}</strong>
                            <span>${escapeHTML(getTransactionLabel(transaction.type))}</span>
                        </div>
                    </div>
                </td>

                <td>
                    <span class="reference-text">
                        ${escapeHTML(transaction.reference || "Unavailable")}
                    </span>
                </td>

                <td>
                    ${escapeHTML(formatDate(transaction.createdAt))}
                </td>

                <td>
                    <span class="transaction-amount ${amountClass}">
                        ${escapeHTML(amountText)}
                    </span>
                </td>

                <td>
                    <span class="transaction-status ${status}">
                        <i class="bx ${status === "completed"
                    ? "bx-check-circle"
                    : status === "failed"
                        ? "bx-x-circle"
                        : "bx-time-five"
                }"></i>

                        ${escapeHTML(getStatusLabel(status))}
                    </span>
                </td>
            `;

            elements.transactionTableBody.appendChild(row);
        });

        /*
         * When a search or filter finds nothing, show the search-specific
         * message instead of the initial account empty state.
         */
        if (state.transactions.length > 0 && filtered.length === 0) {
            elements.emptyState.classList.add("hidden");
        }
    }

    /*
    |--------------------------------------------------------------------------
    | DATA INTEGRATION POINT
    |--------------------------------------------------------------------------
    | Replace these placeholder integration functions with your backend API.
    |
    | The backend must authenticate the user, authorize account access,
    | validate all financial requests, and return verified wallet data.
    |--------------------------------------------------------------------------
    */

    async function fetchWalletData() {
        /*
         * Example integration:
         *
         * const response = await fetch("/api/wallet", {
         *     credentials: "include",
         *     headers: { "Accept": "application/json" }
         * });
         *
         * if (!response.ok) throw new Error("Could not load wallet.");
         *
         * const data = await response.json();
         *
         * state.wallet = data.wallet;
         * state.transactions = data.transactions;
         *
         * renderWallet();
         * renderTransactions();
         */

        throw new Error("Wallet API has not been connected.");
    }

    async function submitFinancialRequest(payload) {
        /*
         * Example integration:
         *
         * const response = await fetch("/api/wallet/requests", {
         *     method: "POST",
         *     credentials: "include",
         *     headers: {
         *         "Content-Type": "application/json",
         *         "Accept": "application/json"
         *     },
         *     body: JSON.stringify(payload)
         * });
         *
         * if (!response.ok) {
         *     throw new Error("The wallet service rejected the request.");
         * }
         *
         * return await response.json();
         */

        throw new Error("Financial request API has not been connected.");
    }

    /*
    |--------------------------------------------------------------------------
    | MODAL
    |--------------------------------------------------------------------------
    */

    function openActionModal(type) {
        state.actionType = type;

        elements.walletActionForm.reset();
        elements.formError.classList.add("hidden");
        elements.formError.textContent = "";

        const isDeposit = type === "deposit";

        elements.modalTitle.textContent = isDeposit
            ? "Deposit funds"
            : "Withdraw funds";

        elements.modalDescription.textContent = isDeposit
            ? "Start a wallet funding request using a supported method."
            : "Submit a withdrawal request using an available destination.";

        elements.modalIcon.innerHTML = isDeposit
            ? '<i class="bx bx-plus-circle"></i>'
            : '<i class="bx bx-arrow-from-bottom"></i>';

        elements.modalNoticeText.textContent =
            "This wallet is not connected to a financial service. Requests cannot be processed yet.";

        elements.destinationGroup.classList.toggle("hidden", isDeposit);

        elements.destinationDetails.required = !isDeposit;

        populatePaymentMethods(type);

        elements.submitWalletAction.disabled = !CONFIG.financialActionsEnabled;

        elements.submitWalletAction.innerHTML = CONFIG.financialActionsEnabled
            ? 'Continue <i class="bx bx-right-arrow-alt"></i>'
            : 'Service unavailable <i class="bx bx-lock-alt"></i>';

        elements.walletModal.classList.remove("hidden");

        document.body.style.overflow = "hidden";

        elements.transactionAmount.focus();
    }

    function closeActionModal() {
        elements.walletModal.classList.add("hidden");
        document.body.style.overflow = "";
        state.actionType = null;
    }

    function populatePaymentMethods(type) {
        const methods = type === "deposit"
            ? CONFIG.depositMethods
            : CONFIG.withdrawalMethods;

        elements.paymentMethod.innerHTML =
            '<option value="">Select a method</option>';

        methods.forEach(method => {
            const option = document.createElement("option");

            option.value = method.id;
            option.textContent = method.label;

            elements.paymentMethod.appendChild(option);
        });

        elements.paymentMethod.disabled = methods.length === 0;

        if (methods.length === 0) {
            const option = document.createElement("option");

            option.value = "";
            option.textContent = "No methods configured";

            elements.paymentMethod.appendChild(option);
        }
    }

    function showFormError(message) {
        elements.formError.textContent = message;
        elements.formError.classList.remove("hidden");
    }

    async function handleFinancialRequest(event) {
        event.preventDefault();

        if (!CONFIG.financialActionsEnabled) {
            showFormError(
                "This wallet service is not connected yet. Your request has not been submitted."
            );

            showToast("Wallet service is not connected.", "error");

            return;
        }

        const amount = Number(elements.transactionAmount.value);
        const method = elements.paymentMethod.value;
        const destination = elements.destinationDetails.value.trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            showFormError("Enter a valid amount greater than zero.");
            return;
        }

        if (!method) {
            showFormError("Select an available payment method.");
            return;
        }

        if (state.actionType === "withdrawal" && !destination) {
            showFormError("Enter your withdrawal destination details.");
            return;
        }

        const payload = {
            type: state.actionType,
            amount,
            method,
            destination: state.actionType === "withdrawal"
                ? destination
                : undefined
        };

        elements.submitWalletAction.disabled = true;
        elements.submitWalletAction.textContent = "Submitting request...";

        try {
            const result = await submitFinancialRequest(payload);

            /*
             * A request acknowledgement is not the same as a completed
             * financial transaction. Use the actual server status.
             */

            if (result.status === "completed") {
                showToast("The transaction was confirmed by the service.", "success");
            } else if (result.status === "pending") {
                showToast("Your request is pending confirmation.", "info");
            } else {
                showToast("The service received your request.", "info");
            }

            closeActionModal();

            await refreshWallet();

        } catch (error) {
            showFormError(
                error.message || "The request could not be processed."
            );
        } finally {
            elements.submitWalletAction.disabled = false;

            elements.submitWalletAction.innerHTML =
                'Continue <i class="bx bx-right-arrow-alt"></i>';
        }
    }

    /*
    |--------------------------------------------------------------------------
    | REFRESH WALLET
    |--------------------------------------------------------------------------
    */

    async function refreshWallet() {
        elements.refreshWallet.disabled = true;

        const icon = elements.refreshWallet.querySelector("i");

        if (icon) {
            icon.classList.add("bx-spin");
        }

        try {
            await fetchWalletData();

            renderWallet();
            renderTransactions();

            showToast("Wallet information updated.", "success");

        } catch (error) {
            /*
             * Do not create fake balances or fake transaction records
             * when the wallet service is unavailable.
             */

            showToast(
                "Wallet data is unavailable. Connect the backend to load your records.",
                "info"
            );

        } finally {
            elements.refreshWallet.disabled = false;

            if (icon) {
                icon.classList.remove("bx-spin");
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | COPY WALLET REFERENCE
    |--------------------------------------------------------------------------
    */

    async function copyWalletReference() {
        const reference = state.wallet?.reference;

        if (!reference) {
            showToast("No wallet reference is available yet.", "info");
            return;
        }

        try {
            await navigator.clipboard.writeText(reference);

            showToast("Wallet reference copied.", "success");

        } catch (error) {
            showToast(
                "Unable to copy automatically. Please copy the reference manually.",
                "error"
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | FILTERS
    |--------------------------------------------------------------------------
    */

    function handleSearch(event) {
        state.searchTerm = event.target.value;
        state.visibleTransactionCount = CONFIG.transactionPageSize;

        renderTransactions();
    }

    function handleTypeFilter(event) {
        state.typeFilter = event.target.value;
        state.visibleTransactionCount = CONFIG.transactionPageSize;

        renderTransactions();
    }

    function handleStatusFilter(event) {
        state.statusFilter = event.target.value;
        state.visibleTransactionCount = CONFIG.transactionPageSize;

        renderTransactions();
    }

    function loadMoreTransactions() {
        state.visibleTransactionCount += CONFIG.transactionPageSize;
        renderTransactions();
    }

    /*
    |--------------------------------------------------------------------------
    | EVENT LISTENERS
    |--------------------------------------------------------------------------
    */

    function bindEvents() {
        elements.mobileMenuBtn.addEventListener("click", openSidebar);
        elements.sidebarClose.addEventListener("click", closeSidebar);
        elements.sidebarOverlay.addEventListener("click", closeSidebar);

        elements.themeToggle.addEventListener("click", toggleTheme);

        elements.balanceVisibility.addEventListener(
            "click",
            toggleBalanceVisibility
        );

        elements.openDeposit.addEventListener("click", () => {
            openActionModal("deposit");
        });

        elements.openWithdraw.addEventListener("click", () => {
            openActionModal("withdrawal");
        });

        elements.refreshWallet.addEventListener("click", refreshWallet);

        elements.closeModal.addEventListener("click", closeActionModal);

        elements.walletModal.addEventListener("click", event => {
            if (event.target === elements.walletModal) {
                closeActionModal();
            }
        });

        elements.walletActionForm.addEventListener(
            "submit",
            handleFinancialRequest
        );

        elements.copyWalletReference.addEventListener(
            "click",
            copyWalletReference
        );

        elements.transactionSearch.addEventListener(
            "input",
            handleSearch
        );

        elements.typeFilter.addEventListener(
            "change",
            handleTypeFilter
        );

        elements.statusFilter.addEventListener(
            "change",
            handleStatusFilter
        );

        elements.loadMore.addEventListener(
            "click",
            loadMoreTransactions
        );

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeActionModal();
                closeSidebar();
            }
        });

        /*
         * Close the mobile sidebar after navigation.
         */
        elements.sidebar.querySelectorAll(".nav-item").forEach(link => {
            link.addEventListener("click", closeSidebar);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | INITIALIZATION
    |--------------------------------------------------------------------------
    */

    function initialize() {
        cacheElements();

        initializeTheme();

        elements.currentYear.textContent = new Date().getFullYear();

        bindEvents();

        renderWallet();
        renderTransactions();

        /*
         * Attempt to load real data. Until the backend is connected,
         * the page remains in its honest, unavailable state.
         */
        refreshWallet();
    }

    return {
        initialize,
        refreshWallet
    };

})();

document.addEventListener("DOMContentLoaded", WalletApp.initialize);