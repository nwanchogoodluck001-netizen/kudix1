"use strict";

/* =========================================================
   KUDIX REGISTRATION
   Frontend validation and interaction only.

   No accounts are created by this file.
   Connect a real authentication service before enabling
   production registration.
========================================================= */

(() => {
    const registrationForm = document.getElementById("registrationForm");

    if (!registrationForm) {
        return;
    }

    const loader = document.getElementById("pageLoader");

    const fullNameInput = document.getElementById("fullName");
    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("email");

    const countryCodeInput = document.getElementById("countryCode");
    const phoneInput = document.getElementById("phone");

    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    const referralCodeInput = document.getElementById("referralCode");
    const referralToggle = document.getElementById("referralToggle");
    const referralContent = document.getElementById("referralContent");

    const termsInput = document.getElementById("termsAccepted");
    const marketingInput = document.getElementById("marketingConsent");

    const registerButton = document.getElementById("registerButton");
    const buttonLabel = registerButton.querySelector(".button-label");

    const formAlert = document.getElementById("formAlert");
    const formAlertText = document.getElementById("formAlertText");

    const passwordStrength = document.getElementById("passwordStrength");
    const passwordStrengthText = document.getElementById("passwordStrengthText");

    const currentYear = document.getElementById("currentYear");

    let hasAttemptedSubmit = false;
    let isSubmitting = false;
    let loaderFallbackTimer = null;


    /* =====================================================
       LOADING SCREEN
    ====================================================== */

    function hideLoader() {
        if (!loader) {
            return;
        }

        if (loaderFallbackTimer) {
            window.clearTimeout(loaderFallbackTimer);
            loaderFallbackTimer = null;
        }

        loader.classList.add("is-hidden");
        loader.setAttribute("aria-hidden", "true");

        window.setTimeout(() => {
            if (loader && loader.parentNode) {
                loader.remove();
            }
        }, 500);
    }

    /*
     * Hide as soon as the DOM is ready.
     * A fallback also prevents a stuck loader if setup fails.
     */
    loaderFallbackTimer = window.setTimeout(hideLoader, 2500);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hideLoader, {
            once: true
        });
    } else {
        hideLoader();
    }

    window.addEventListener("load", hideLoader, {
        once: true
    });


    /* =====================================================
       CURRENT YEAR
    ====================================================== */

    if (currentYear) {
        currentYear.textContent = String(new Date().getFullYear());
    }


    /* =====================================================
       FIELD ERROR HELPERS
    ====================================================== */

    const errorElements = {
        fullName: document.getElementById("fullNameError"),
        username: document.getElementById("usernameError"),
        email: document.getElementById("emailError"),
        phone: document.getElementById("phoneError"),
        password: document.getElementById("passwordError"),
        confirmPassword: document.getElementById("confirmPasswordError"),
        referralCode: document.getElementById("referralCodeError"),
        terms: document.getElementById("termsError")
    };

    function getErrorElement(fieldName) {
        return errorElements[fieldName] || null;
    }

    function setFieldError(fieldName, message) {
        const errorElement = getErrorElement(fieldName);

        let field = null;

        switch (fieldName) {
            case "fullName":
                field = fullNameInput;
                break;

            case "username":
                field = usernameInput;
                break;

            case "email":
                field = emailInput;
                break;

            case "phone":
                field = phoneInput;
                break;

            case "password":
                field = passwordInput;
                break;

            case "confirmPassword":
                field = confirmPasswordInput;
                break;

            case "referralCode":
                field = referralCodeInput;
                break;

            case "terms":
                field = termsInput;
                break;

            default:
                break;
        }

        if (errorElement) {
            errorElement.textContent = message || "";
        }

        if (field) {
            if (message) {
                field.setAttribute("aria-invalid", "true");
            } else {
                field.removeAttribute("aria-invalid");
            }
        }
    }

    function clearFieldError(fieldName) {
        setFieldError(fieldName, "");
    }

    function clearAllErrors() {
        Object.keys(errorElements).forEach(clearFieldError);
    }


    /* =====================================================
       GENERAL FORM ALERT
    ====================================================== */

    function showAlert(message, type = "info") {
        if (!formAlert || !formAlertText) {
            return;
        }

        formAlert.hidden = false;
        formAlert.classList.remove("is-error", "is-success");

        if (type === "error") {
            formAlert.classList.add("is-error");
        } else if (type === "success") {
            formAlert.classList.add("is-success");
        }

        formAlertText.textContent = message;
    }

    function clearAlert() {
        if (!formAlert) {
            return;
        }

        formAlert.hidden = true;
        formAlert.classList.remove("is-error", "is-success");

        if (formAlertText) {
            formAlertText.textContent = "";
        }
    }


    /* =====================================================
       PASSWORD VISIBILITY
    ====================================================== */

    document.querySelectorAll("[data-password-target]").forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-password-target");
            const input = document.getElementById(targetId);

            if (!input) {
                return;
            }

            const shouldShow = input.type === "password";

            input.type = shouldShow ? "text" : "password";

            button.setAttribute(
                "aria-label",
                shouldShow
                    ? "Hide password"
                    : targetId === "confirmPassword"
                        ? "Show confirmation password"
                        : "Show password"
            );

            button.setAttribute("aria-pressed", String(shouldShow));

            const icon = button.querySelector("i");

            if (icon) {
                icon.classList.toggle("bx-show", !shouldShow);
                icon.classList.toggle("bx-hide", shouldShow);
            }
        });
    });


    /* =====================================================
       PASSWORD STRENGTH
    ====================================================== */

    function calculatePasswordStrength(password) {
        if (!password) {
            return {
                score: 0,
                label: "Password strength will appear here."
            };
        }

        let score = 0;

        const checks = [
            password.length >= 8,
            /[a-z]/.test(password),
            /[A-Z]/.test(password),
            /\d/.test(password),
            /[^A-Za-z0-9]/.test(password)
        ];

        score = checks.filter(Boolean).length;

        /*
         * Penalize extremely repetitive or simple patterns.
         * This is only a user-interface estimate, not a
         * replacement for server-side password checks.
         */
        if (/^(.)\1+$/.test(password)) {
            score = Math.min(score, 1);
        }

        if (/^(password|qwerty|12345678|letmein)/i.test(password)) {
            score = Math.min(score, 2);
        }

        if (password.length < 8) {
            score = Math.min(score, 1);
        }

        if (score <= 2) {
            return {
                score: 1,
                label: "Weak password"
            };
        }

        if (score === 3) {
            return {
                score: 2,
                label: "Fair password"
            };
        }

        if (score === 4) {
            return {
                score: 3,
                label: "Good password"
            };
        }

        return {
            score: 4,
            label: "Strong password"
        };
    }

    function updatePasswordStrength() {
        const password = passwordInput.value;
        const result = calculatePasswordStrength(password);

        passwordStrength.dataset.strength = String(result.score);

        passwordStrengthText.textContent = result.label;
    }

    passwordInput.addEventListener("input", () => {
        updatePasswordStrength();

        if (hasAttemptedSubmit || passwordInput.value.length > 0) {
            validatePassword();
        }

        if (confirmPasswordInput.value.length > 0) {
            validateConfirmPassword();
        }
    });


    /* =====================================================
       REFERRAL FIELD
    ====================================================== */

    function openReferralField() {
        if (!referralToggle || !referralContent) {
            return;
        }

        referralContent.hidden = false;
        referralToggle.setAttribute("aria-expanded", "true");
    }

    if (referralToggle && referralContent) {
        referralToggle.addEventListener("click", () => {
            const isExpanded =
                referralToggle.getAttribute("aria-expanded") === "true";

            referralToggle.setAttribute(
                "aria-expanded",
                String(!isExpanded)
            );

            referralContent.hidden = isExpanded;

            if (!isExpanded) {
                referralCodeInput.focus();
            }
        });
    }

    /*
     * Populate a referral code from:
     * register.html?ref=ABC123
     *
     * The code remains unverified until a backend checks it.
     */
    try {
        const params = new URLSearchParams(window.location.search);
        const referralFromUrl = params.get("ref");

        if (referralFromUrl && referralCodeInput) {
            const cleanedCode = referralFromUrl
                .trim()
                .slice(0, 64);

            referralCodeInput.value = cleanedCode;

            if (cleanedCode) {
                openReferralField();
            }
        }
    } catch {
        /*
         * An invalid URL parameter must not stop the form
         * from loading.
         */
    }


    /* =====================================================
       INPUT NORMALIZATION
    ====================================================== */

    usernameInput.addEventListener("input", () => {
        /*
         * Normalize usernames to lowercase.
         * Validation still happens separately.
         */
        const cursorPosition = usernameInput.selectionStart;
        usernameInput.value = usernameInput.value.toLowerCase();

        try {
            usernameInput.setSelectionRange(cursorPosition, cursorPosition);
        } catch {
            // Ignore unsupported selection operations.
        }

        if (hasAttemptedSubmit || usernameInput.value.length > 0) {
            validateUsername();
        }
    });

    emailInput.addEventListener("blur", () => {
        emailInput.value = emailInput.value.trim();
    });

    referralCodeInput.addEventListener("input", () => {
        referralCodeInput.value = referralCodeInput.value
            .trimStart()
            .slice(0, 64);

        if (hasAttemptedSubmit) {
            validateReferralCodeFormat();
        }
    });


    /* =====================================================
       FIELD VALIDATORS
    ====================================================== */

    function validateFullName() {
        const value = fullNameInput.value.trim();

        if (!value) {
            setFieldError("fullName", "Please enter your full name.");
            return false;
        }

        if (value.length < 2) {
            setFieldError(
                "fullName",
                "Your full name must contain at least 2 characters."
            );
            return false;
        }

        if (value.length > 100) {
            setFieldError(
                "fullName",
                "Your full name is too long."
            );
            return false;
        }

        clearFieldError("fullName");
        return true;
    }

    function validateUsername() {
        const value = usernameInput.value.trim();

        if (!value) {
            setFieldError("username", "Please choose a username.");
            return false;
        }

        if (value.length < 3 || value.length > 20) {
            setFieldError(
                "username",
                "Use between 3 and 20 characters."
            );
            return false;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            setFieldError(
                "username",
                "Use only letters, numbers, and underscores."
            );
            return false;
        }

        clearFieldError("username");
        return true;
    }

    function validateEmail() {
        const value = emailInput.value.trim();

        if (!value) {
            setFieldError("email", "Please enter your email address.");
            return false;
        }

        /*
         * A practical client-side check.
         * The authentication server must validate email addresses too.
         */
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

        if (!emailPattern.test(value)) {
            setFieldError("email", "Enter a valid email address.");
            return false;
        }

        if (value.length > 254) {
            setFieldError("email", "That email address is too long.");
            return false;
        }

        clearFieldError("email");
        return true;
    }

    function normalizePhoneDigits(value) {
        return value.replace(/\D/g, "");
    }

    function getNormalizedPhone() {
        const countryCode = countryCodeInput.value;
        let digits = normalizePhoneDigits(phoneInput.value);

        /*
         * Nigeria:
         * 08012345678 -> +2348012345678
         * 8012345678  -> +2348012345678
         *
         * Strip one national trunk zero only when the Nigerian
         * country code is selected. Never add an extra zero.
         */
        if (countryCode === "+234" && digits.startsWith("0")) {
            digits = digits.slice(1);
        }

        return `${countryCode}${digits}`;
    }

    function validatePhone() {
        const rawValue = phoneInput.value.trim();
        const countryCode = countryCodeInput.value;

        if (!rawValue) {
            setFieldError("phone", "Please enter your phone number.");
            return false;
        }

        /*
         * Allow users to paste a number with its country code,
         * provided that it matches the selected country code.
         */
        let digits = normalizePhoneDigits(rawValue);

        const rawStartsWithPlus = rawValue.startsWith("+");

        if (rawStartsWithPlus) {
            const pastedInternational = rawValue.replace(/[^\d+]/g, "");

            if (!pastedInternational.startsWith(countryCode)) {
                setFieldError(
                    "phone",
                    "The number's country code does not match your selection."
                );
                return false;
            }

            digits = normalizePhoneDigits(
                pastedInternational.slice(countryCode.length)
            );
        }

        if (countryCode === "+234" && digits.startsWith("0")) {
            digits = digits.slice(1);
        }

        /*
         * Generic international digit-count check.
         * Production phone verification should use a proper
         * phone-number library or authentication provider.
         */
        if (digits.length < 7 || digits.length > 14) {
            setFieldError(
                "phone",
                "Enter a valid phone number for the selected country."
            );
            return false;
        }

        if (!/^\d+$/.test(digits)) {
            setFieldError(
                "phone",
                "Please check your phone number."
            );
            return false;
        }

        clearFieldError("phone");
        return true;
    }

    function validatePassword() {
        const value = passwordInput.value;

        if (!value) {
            setFieldError("password", "Please create a password.");
            return false;
        }

        if (value.length < 8) {
            setFieldError(
                "password",
                "Your password must contain at least 8 characters."
            );
            return false;
        }

        if (value.length > 128) {
            setFieldError(
                "password",
                "Your password is too long."
            );
            return false;
        }

        if (!/[a-z]/.test(value)) {
            setFieldError(
                "password",
                "Include at least one lowercase letter."
            );
            return false;
        }

        if (!/[A-Z]/.test(value)) {
            setFieldError(
                "password",
                "Include at least one uppercase letter."
            );
            return false;
        }

        if (!/\d/.test(value)) {
            setFieldError(
                "password",
                "Include at least one number."
            );
            return false;
        }

        if (!/[^A-Za-z0-9]/.test(value)) {
            setFieldError(
                "password",
                "Include at least one symbol, such as ! or @."
            );
            return false;
        }

        clearFieldError("password");
        return true;
    }

    function validateConfirmPassword() {
        const password = passwordInput.value;
        const confirmation = confirmPasswordInput.value;

        if (!confirmation) {
            setFieldError(
                "confirmPassword",
                "Please re-enter your password."
            );
            return false;
        }

        if (password !== confirmation) {
            setFieldError(
                "confirmPassword",
                "Your passwords do not match."
            );
            return false;
        }

        clearFieldError("confirmPassword");
        return true;
    }

    function validateReferralCodeFormat() {
        const code = referralCodeInput.value.trim();

        /*
         * This checks only for obviously malformed input.
         * It does not establish whether a referral code exists,
         * is active, or is eligible for a commission.
         */
        if (!code) {
            clearFieldError("referralCode");
            return true;
        }

        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(code)) {
            setFieldError(
                "referralCode",
                "Use only letters, numbers, hyphens, and underscores."
            );
            return false;
        }

        clearFieldError("referralCode");
        return true;
    }

    function validateTerms() {
        if (!termsInput.checked) {
            setFieldError(
                "terms",
                "Please accept the Terms and Conditions to continue."
            );
            return false;
        }

        clearFieldError("terms");
        return true;
    }


    /* =====================================================
       VALIDATE ALL FIELDS
    ====================================================== */

    function validateForm() {
        const results = [
            validateFullName(),
            validateUsername(),
            validateEmail(),
            validatePhone(),
            validatePassword(),
            validateConfirmPassword(),
            validateReferralCodeFormat(),
            validateTerms()
        ];

        return results.every(Boolean);
    }


    /* =====================================================
       LIVE VALIDATION
    ====================================================== */

    fullNameInput.addEventListener("blur", () => {
        if (hasAttemptedSubmit || fullNameInput.value.trim()) {
            validateFullName();
        }
    });

    usernameInput.addEventListener("blur", () => {
        if (hasAttemptedSubmit || usernameInput.value.trim()) {
            validateUsername();
        }
    });

    emailInput.addEventListener("blur", () => {
        if (hasAttemptedSubmit || emailInput.value.trim()) {
            validateEmail();
        }
    });

    phoneInput.addEventListener("blur", () => {
        if (hasAttemptedSubmit || phoneInput.value.trim()) {
            validatePhone();
        }
    });

    phoneInput.addEventListener("input", () => {
        if (hasAttemptedSubmit) {
            validatePhone();
        }
    });

    countryCodeInput.addEventListener("change", () => {
        if (hasAttemptedSubmit || phoneInput.value.trim()) {
            validatePhone();
        }
    });

    confirmPasswordInput.addEventListener("input", () => {
        if (
            hasAttemptedSubmit ||
            confirmPasswordInput.value.length > 0
        ) {
            validateConfirmPassword();
        }
    });

    confirmPasswordInput.addEventListener("blur", () => {
        if (hasAttemptedSubmit || confirmPasswordInput.value) {
            validateConfirmPassword();
        }
    });

    termsInput.addEventListener("change", () => {
        if (hasAttemptedSubmit || termsInput.checked) {
            validateTerms();
        }
    });


    /* =====================================================
       FOCUS FIRST INVALID FIELD
    ====================================================== */

    function focusFirstInvalidField() {
        const firstInvalid = registrationForm.querySelector(
            '[aria-invalid="true"]'
        );

        if (firstInvalid) {
            firstInvalid.focus({
                preventScroll: false
            });

            return;
        }

        if (!termsInput.checked) {
            termsInput.focus({
                preventScroll: false
            });
        }
    }


    /* =====================================================
       BUTTON STATE
    ====================================================== */

    function setSubmittingState(isLoading) {
        isSubmitting = isLoading;

        registerButton.disabled = isLoading;
        registerButton.classList.toggle("is-loading", isLoading);

        registerButton.setAttribute(
            "aria-busy",
            String(isLoading)
        );

        buttonLabel.textContent = isLoading
            ? "Preparing..."
            : "Create My Account";
    }


    /* =====================================================
       REGISTRATION SUBMISSION
    ====================================================== */

    registrationForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        hasAttemptedSubmit = true;
        clearAlert();

        const isValid = validateForm();

        if (!isValid) {
            showAlert(
                "Please review the highlighted fields and correct the errors.",
                "error"
            );

            focusFirstInvalidField();
            return;
        }

        /*
         * FRONTEND-ONLY SAFETY:
         *
         * No registration API is connected.
         * Do not send passwords to a placeholder endpoint,
         * store them in browser storage, or claim that an
         * account has been created.
         *
         * When integrating authentication, replace this block
         * with a request to the real authentication service.
         */

        setSubmittingState(true);

        try {
            /*
             * Prepare a normalized payload for future integration.
             * It is deliberately not sent or stored.
             */
            const registrationDraft = {
                fullName: fullNameInput.value.trim(),
                username: usernameInput.value.trim().toLowerCase(),
                email: emailInput.value.trim().toLowerCase(),
                phone: getNormalizedPhone(),
                referralCode: referralCodeInput.value.trim() || null,
                marketingConsent: Boolean(marketingInput.checked),
                termsAccepted: Boolean(termsInput.checked)
            };

            /*
             * Do not log registrationDraft or credentials.
             * This variable is only a local integration example.
             */
            void registrationDraft;

            showAlert(
                "Your details passed the browser checks, but account creation is not connected yet. No account has been created. Connect your authentication service to enable registration.",
                "info"
            );

            setSubmittingState(false);

        } catch {
            /*
             * Keep the message generic. Never expose internal
             * server errors or credentials.
             */
            showAlert(
                "We could not process your request. Please try again later.",
                "error"
            );

            setSubmittingState(false);
        }
    });


    /* =====================================================
       INITIAL SETUP
    ====================================================== */

    clearAllErrors();
    clearAlert();
    updatePasswordStrength();

    /*
     * This page deliberately leaves the submit button enabled
     * so users can see client-side validation. A real backend
     * must repeat all validation and enforce account rules.
     */
})();