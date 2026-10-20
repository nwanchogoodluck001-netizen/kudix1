"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    /*
     * KUDIX LEVEL-UP CONFIGURATION
     *
     * Set the fee and endpoints when your backend is ready.
     *
     * IMPORTANT:
     * - Never put a Paystack secret key in frontend code.
     * - The backend must initialize transactions with Paystack.
     * - The backend must verify the transaction before upgrading
     *   the user's account.
     * - Do not trust a checkout redirect as proof of payment.
     */

    const CONFIG = Object.freeze({
        currency: "NGN",

        // Set this to the fee in naira when confirmed by the site owner.
        levelUpFeeNaira: null,

        // Public key only. This is not a secret, but must be a real
        // Paystack public key before enabling the checkout integration.
        paystackPublicKey: "",

        /*
         * Replace these with your actual authenticated backend endpoints.
         *
         * Expected initialization response:
         * {
         *   "authorization_url": "https://checkout.paystack.com/...",
         *   "reference": "server-generated-reference"
         * }
         *
         * The backend must derive the user identity from the authenticated
         * session and set the amount and currency from trusted configuration.
         */
        initializeEndpoint: "",
        verifyEndpoint: "",

        // Keep false until the real backend and payment flow are ready.
        enabled: false
    });

    const THEME_KEY = "kudix-theme";

    const sidebar = $("#sidebar");
    const sidebarOverlay = $("#sidebarOverlay");
    const menuToggle = $("#menuToggle");
    const themeToggle = $("#themeToggle");

    const paystackButton = $("#paystackButton");
    const payButtonText = $("#payButtonText");
    const feeAmount = $("#feeAmount");
    const configurationNote = $("#configurationNote");

    const statusMessage = $("#statusMessage");
    const statusIcon = $("#statusIcon");
    const statusText = $("#statusText");

    let paymentInProgress = false;

    /* --------------------------------
       THEME
    -------------------------------- */

    function readSavedTheme() {
        try {
            return localStorage.getItem(THEME_KEY) === "light"
                ? "light"
                : "dark";
        } catch {
            return "dark";
        }
    }

    function applyTheme(theme) {
        const safeTheme = theme === "light" ? "light" : "dark";

        document.body.classList.toggle(
            "light-theme",
            safeTheme === "light"
        );

        document.documentElement.dataset.theme = safeTheme;
        document.documentElement.style.colorScheme = safeTheme;

        if (themeToggle) {
            const icon = $("i", themeToggle);

            if (icon) {
                icon.className = safeTheme === "dark"
                    ? "bx bx-sun"
                    : "bx bx-moon";
            }

            themeToggle.setAttribute(
                "aria-label",
                `Switch to ${safeTheme === "dark" ? "light" : "dark"} theme`
            );
        }
    }

    applyTheme(readSavedTheme());

    themeToggle?.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("light-theme")
            ? "dark"
            : "light";

        applyTheme(nextTheme);

        try {
            localStorage.setItem(THEME_KEY, nextTheme);
        } catch {
            // Theme still applies to the current page session.
        }
    });

    window.addEventListener("storage", (event) => {
        if (event.key === THEME_KEY) {
            applyTheme(event.newValue === "light" ? "light" : "dark");
        }
    });

    /* --------------------------------
       MOBILE SIDEBAR
    -------------------------------- */

    function openSidebar() {
        if (!sidebar) return;

        sidebar.classList.add("open");
        sidebarOverlay?.classList.add("visible");
        menuToggle?.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar?.classList.remove("open");
        sidebarOverlay?.classList.remove("visible");
        menuToggle?.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    }

    menuToggle?.addEventListener("click", () => {
        if (sidebar?.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    sidebarOverlay?.addEventListener("click", closeSidebar);

    sidebar?.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) {
            closeSidebar();
        }
    });

    /* --------------------------------
       FEE DISPLAY
    -------------------------------- */

    function formatNaira(amount) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    function isValidFee(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value) &&
            value > 0 &&
            value <= Number.MAX_SAFE_INTEGER / 100
        );
    }

    function renderFee() {
        if (!feeAmount) return;

        const amountIsConfigured = isValidFee(
            CONFIG.levelUpFeeNaira
        );

        if (amountIsConfigured) {
            feeAmount.innerHTML = "";

            const currency = document.createElement("span");
            currency.className = "fee-currency";
            currency.textContent = CONFIG.currency;

            const amount = document.createElement("strong");
            amount.textContent = formatNaira(CONFIG.levelUpFeeNaira);

            feeAmount.append(currency, amount);
        } else {
            feeAmount.innerHTML = "";

            const currency = document.createElement("span");
            currency.className = "fee-currency";
            currency.textContent = CONFIG.currency;

            const amount = document.createElement("strong");
            amount.textContent = "Not set";

            feeAmount.append(currency, amount);
        }
    }

    /* --------------------------------
       STATUS MESSAGES
    -------------------------------- */

    function showStatus(message, type = "info") {
        if (!statusMessage || !statusText || !statusIcon) return;

        statusMessage.classList.remove(
            "is-error",
            "is-success"
        );

        if (type === "error") {
            statusMessage.classList.add("is-error");
            statusIcon.className = "bx bx-error-circle";
        } else if (type === "success") {
            statusMessage.classList.add("is-success");
            statusIcon.className = "bx bx-check-circle";
        } else {
            statusIcon.className = "bx bx-info-circle";
        }

        statusText.textContent = message;
        statusMessage.hidden = false;

        statusMessage.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            block: "nearest"
        });
    }

    function hideStatus() {
        if (statusMessage) {
            statusMessage.hidden = true;
        }
    }

    /* --------------------------------
       CHECK PAYMENT CONFIGURATION
    -------------------------------- */

    function isValidPaystackPublicKey(key) {
        return (
            typeof key === "string" &&
            /^pk_(test|live)_[A-Za-z0-9]+$/.test(key)
        );
    }

    function hasValidEndpoint(value) {
        if (typeof value !== "string" || !value.trim()) {
            return false;
        }

        try {
            const url = new URL(value, window.location.origin);

            // Require HTTPS for remote endpoints. Localhost is allowed
            // for development only.
            const isLocalhost = [
                "localhost",
                "127.0.0.1",
                "::1"
            ].includes(url.hostname);

            return (
                url.protocol === "https:" ||
                (isLocalhost && url.protocol === "http:")
            );
        } catch {
            return false;
        }
    }

    function isPaymentConfigured() {
        return (
            CONFIG.enabled === true &&
            isValidFee(CONFIG.levelUpFeeNaira) &&
            isValidPaystackPublicKey(CONFIG.paystackPublicKey) &&
            hasValidEndpoint(CONFIG.initializeEndpoint) &&
            hasValidEndpoint(CONFIG.verifyEndpoint)
        );
    }

    function setButtonState({
        disabled,
        text,
        loading = false
    }) {
        if (!paystackButton || !payButtonText) return;

        paystackButton.disabled = disabled;
        payButtonText.textContent = text;

        paystackButton.classList.toggle("is-loading", loading);
        paystackButton.setAttribute(
            "aria-busy",
            loading ? "true" : "false"
        );
    }

    function renderPaymentConfiguration() {
        renderFee();

        if (isPaymentConfigured()) {
            setButtonState({
                disabled: false,
                text: "Level Up with Paystack"
            });

            if (configurationNote) {
                configurationNote.textContent =
                    "Your payment will be processed through Paystack. " +
                    "Your account level changes only after server-side verification.";
            }

            return;
        }

        setButtonState({
            disabled: true,
            text: "Payment unavailable"
        });

        if (configurationNote) {
            configurationNote.textContent =
                "Payment is currently unavailable. Configure the account level-up fee, " +
                "Paystack public key, and secure backend endpoints before enabling checkout.";
        }
    }

    /* --------------------------------
       INITIALIZE CHECKOUT
    -------------------------------- */

    async function initializeCheckout() {
        if (paymentInProgress) return;

        hideStatus();

        if (!isPaymentConfigured()) {
            showStatus(
                "Payment is not configured yet. Please try again after the platform's payment service is ready.",
                "error"
            );
            return;
        }

        paymentInProgress = true;

        setButtonState({
            disabled: true,
            text: "Preparing secure checkout...",
            loading: true
        });

        try {
            /*
             * The backend must:
             * 1. Authenticate the user.
             * 2. Read the fee from trusted server-side configuration.
             * 3. Initialize a Paystack transaction in kobo.
             * 4. Generate and store a transaction reference.
             * 5. Return the hosted checkout URL and reference.
             *
             * Do not accept a client-supplied amount as authoritative.
             */

            const response = await fetch(CONFIG.initializeEndpoint, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    purpose: "account_level_up",
                    currency: CONFIG.currency
                })
            });

            if (!response.ok) {
                throw new Error(
                    response.status === 401
                        ? "Please sign in again to continue."
                        : "The payment service could not initialize checkout."
                );
            }

            const result = await response.json();

            if (
                !result ||
                typeof result.authorization_url !== "string" ||
                typeof result.reference !== "string"
            ) {
                throw new Error(
                    "The payment service returned an invalid checkout response."
                );
            }

            let checkoutURL;

            try {
                checkoutURL = new URL(result.authorization_url);
            } catch {
                throw new Error("The checkout URL is invalid.");
            }

            if (
                checkoutURL.protocol !== "https:" ||
                checkoutURL.hostname !== "checkout.paystack.com"
            ) {
                throw new Error("The checkout destination could not be validated.");
            }

            /*
             * The backend must retain the reference and associate it with
             * the authenticated user. The frontend does not mark the
             * account as upgraded here.
             */
            window.location.assign(checkoutURL.href);
        } catch (error) {
            showStatus(
                error instanceof Error
                    ? error.message
                    : "Unable to start checkout. Please try again later.",
                "error"
            );

            paymentInProgress = false;

            renderPaymentConfiguration();
        }
    }

    paystackButton?.addEventListener("click", initializeCheckout);

    /* --------------------------------
       PAYMENT RETURN HANDLING
    -------------------------------- */

    async function handlePaymentReturn() {
        /*
         * After Paystack redirects back to this page, the backend must
         * verify the reference with Paystack before updating the account.
         *
         * Example return URL:
         * level-up.html?payment=return&reference=SERVER_GENERATED_REFERENCE
         *
         * This frontend never treats the query string itself as proof
         * of payment. The server verification endpoint must authenticate
         * the user and check reference ownership, amount, currency,
         * transaction status, and the account-level update.
         */

        const params = new URLSearchParams(window.location.search);
        const returnState = params.get("payment");
        const reference = params.get("reference");

        if (!returnState) return;

        if (returnState === "cancelled") {
            showStatus(
                "Checkout was cancelled. Your account level has not been changed.",
                "info"
            );
            return;
        }

        if (returnState !== "return" || !reference) {
            showStatus(
                "Payment status could not be confirmed. Please contact support if you completed a payment.",
                "error"
            );
            return;
        }

        /*
         * Verify only if the backend is configured. Never report success
         * based on the redirect alone.
         */
        if (!hasValidEndpoint(CONFIG.verifyEndpoint)) {
            showStatus(
                "Your payment status cannot be verified because the verification service is not configured. No account upgrade has been confirmed.",
                "error"
            );
            return;
        }

        showStatus(
            "Checking payment status with the account service. Please wait for verification.",
            "info"
        );

        try {
            const response = await fetch(CONFIG.verifyEndpoint, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ reference })
            });

            if (!response.ok) {
                throw new Error("Payment verification is still unavailable.");
            }

            const result = await response.json();

            if (
                result?.verified === true &&
                result?.account_level_updated === true
            ) {
                showStatus(
                    "Payment verified and your account level has been updated.",
                    "success"
                );
            } else if (result?.pending === true) {
                showStatus(
                    "Your payment is awaiting confirmation. Your account level will update only after verification is complete.",
                    "info"
                );
            } else {
                showStatus(
                    "The payment has not been verified as successful. Your account level has not been changed.",
                    "error"
                );
            }
        } catch (error) {
            showStatus(
                error instanceof Error
                    ? error.message
                    : "We could not verify the payment. Please check again later.",
                "error"
            );
        } finally {
            /*
             * Remove payment return parameters to avoid accidental
             * repeated verification if the page is refreshed.
             * The backend must still handle duplicate verification safely.
             */
            const cleanURL = new URL(window.location.href);
            cleanURL.searchParams.delete("payment");
            cleanURL.searchParams.delete("reference");

            window.history.replaceState({}, "", cleanURL.pathname + cleanURL.search + cleanURL.hash);
        }
    }

    /* --------------------------------
       FOOTER
    -------------------------------- */

    const currentYear = $("#currentYear");

    if (currentYear) {
        currentYear.textContent = String(new Date().getFullYear());
    }

    /* --------------------------------
       INITIALIZE PAGE
    -------------------------------- */

    renderPaymentConfiguration();
    handlePaymentReturn();
});