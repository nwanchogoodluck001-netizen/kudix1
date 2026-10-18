/* =========================================
   KUDIX SETTINGS
   Frontend-only settings functionality
========================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEYS = {
        theme: "kudix-theme",
        profile: "kudix-settings-profile",
        preferences: "kudix-settings-preferences",
        notifications: "kudix-settings-notifications"
    };

    const DEFAULT_PREFERENCES = {
        language: "en",
        currency: "NGN",
        dateFormat: "DD/MM/YYYY"
    };

    const DEFAULT_NOTIFICATIONS = {
        security: true,
        games: true,
        tasks: true,
        transactions: true,
        referrals: true,
        announcements: false
    };

    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    /* -----------------------------------------
       Safe local storage helpers
    ----------------------------------------- */

    function readStorage(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;

            return JSON.parse(raw);
        } catch (error) {
            console.warn(`Could not read ${key} from local storage.`);
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            showToast(
                "Unable to save",
                "Your browser could not save this preference. Check your browser storage settings.",
                "error"
            );
            return false;
        }
    }

    function readTheme() {
        try {
            const theme = localStorage.getItem(STORAGE_KEYS.theme);
            return theme === "dark" || theme === "light" ? theme : "light";
        } catch {
            return "light";
        }
    }

    function writeTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEYS.theme, theme);
            return true;
        } catch {
            showToast(
                "Theme not saved",
                "Your theme has changed for this visit, but the browser could not save it.",
                "error"
            );
            return false;
        }
    }

    function getStoredObject(key, defaults) {
        const stored = readStorage(key, {});
        if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
            return { ...defaults };
        }

        return { ...defaults, ...stored };
    }

    /* -----------------------------------------
       Toast notifications
    ----------------------------------------- */

    function showToast(title, message, type = "success") {
        const container = $("#toastContainer");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast${type === "error" ? " error" : ""}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");

        const icon = document.createElement("i");
        icon.className = type === "error" ? "bx bx-error-circle" : "bx bx-check-circle";
        icon.setAttribute("aria-hidden", "true");

        const content = document.createElement("div");
        const heading = document.createElement("strong");
        const description = document.createElement("p");

        heading.textContent = title;
        description.textContent = message;

        content.append(heading, description);
        toast.append(icon, content);
        container.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 4200);
    }

    /* -----------------------------------------
       Theme
    ----------------------------------------- */

    const themeToggle = $("#themeToggle");

    function applyTheme(theme, persist = true) {
        const safeTheme = theme === "dark" ? "dark" : "light";

        document.body.classList.toggle("dark-theme", safeTheme === "dark");
        document.documentElement.dataset.theme = safeTheme;
        document.documentElement.style.colorScheme = safeTheme;

        if (themeToggle) {
            const icon = $("i", themeToggle);
            const nextTheme = safeTheme === "dark" ? "light" : "dark";

            if (icon) {
                icon.className = safeTheme === "dark" ? "bx bx-sun" : "bx bx-moon";
            }

            themeToggle.setAttribute(
                "aria-label",
                `Switch to ${nextTheme} theme`
            );
            themeToggle.setAttribute(
                "title",
                `Switch to ${nextTheme} theme`
            );
        }

        $$("[data-theme-choice]").forEach((button) => {
            const selected = button.dataset.themeChoice === safeTheme;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-pressed", String(selected));
        });

        if (persist) writeTheme(safeTheme);
    }

    applyTheme(readTheme(), false);

    themeToggle?.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("dark-theme")
            ? "light"
            : "dark";

        applyTheme(nextTheme);
    });

    $$("[data-theme-choice]").forEach((button) => {
        button.addEventListener("click", () => {
            const theme = button.dataset.themeChoice;

            if (theme === "light" || theme === "dark") {
                applyTheme(theme);
            }
        });
    });

    /* -----------------------------------------
       Responsive sidebar
    ----------------------------------------- */

    const sidebar = $("#sidebar");
    const menuToggle = $("#menuToggle");
    const sidebarOverlay = $("#sidebarOverlay");

    function openSidebar() {
        if (!sidebar || !menuToggle) return;

        sidebar.classList.add("open");
        sidebarOverlay?.classList.add("visible");
        menuToggle.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar?.classList.remove("open");
        sidebarOverlay?.classList.remove("visible");
        menuToggle?.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    }

    menuToggle?.addEventListener("click", () => {
        sidebar?.classList.contains("open")
            ? closeSidebar()
            : openSidebar();
    });

    sidebarOverlay?.addEventListener("click", closeSidebar);

    $$(".sidebar .nav-link").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) closeSidebar();
    });

    /* -----------------------------------------
       Settings section navigation
    ----------------------------------------- */

    const sectionButtons = $$("[data-section]");
    const sections = $$("[data-panel]");

    function activateSection(name, moveFocus = false) {
        const selectedButton = sectionButtons.find(
            (button) => button.dataset.section === name
        );

        const selectedSection = sections.find(
            (section) => section.dataset.panel === name
        );

        if (!selectedButton || !selectedSection) return;

        sectionButtons.forEach((button) => {
            const selected = button === selectedButton;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-current", selected ? "location" : "false");
        });

        sections.forEach((section) => {
            const selected = section === selectedSection;
            section.hidden = !selected;
            section.classList.toggle("active", selected);
        });

        if (moveFocus && window.innerWidth <= 980) {
            selectedSection.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
                block: "start"
            });
        }
    }

    sectionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activateSection(button.dataset.section, true);
        });
    });

    /* -----------------------------------------
       Profile information
    ----------------------------------------- */

    const profileForm = $("#profileForm");

    const profileFields = {
        displayName: $("#displayName"),
        emailAddress: $("#emailAddress"),
        phoneNumber: $("#phoneNumber"),
        country: $("#country")
    };

    function cleanText(value, maxLength = 254) {
        return String(value ?? "")
            .trim()
            .slice(0, maxLength);
    }

    function validEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function getProfile() {
        return getStoredObject(STORAGE_KEYS.profile, {
            displayName: "",
            emailAddress: "",
            phoneNumber: "",
            country: ""
        });
    }

    function setFieldError(field, invalid) {
        if (!field) return;

        field.setAttribute("aria-invalid", String(invalid));
    }

    function updateProfilePreview(profile) {
        const name = cleanText(profile.displayName, 60);
        const email = cleanText(profile.emailAddress, 254);
        const initial = name ? Array.from(name)[0].toUpperCase() : "K";

        const displayName = name || "Your profile";
        const displayEmail = email || "Add your email address";

        const previewName = $("#previewName");
        const previewEmail = $("#previewEmail");
        const profileAvatar = $("#profileAvatar");
        const topProfileName = $("#topProfileName");
        const topAvatar = $("#topAvatar");

        if (previewName) previewName.textContent = displayName;
        if (previewEmail) previewEmail.textContent = displayEmail;
        if (profileAvatar) profileAvatar.textContent = initial;
        if (topProfileName) topProfileName.textContent = displayName;
        if (topAvatar) topAvatar.textContent = initial;
    }

    function loadProfile() {
        const profile = getProfile();

        Object.entries(profileFields).forEach(([key, field]) => {
            if (field && typeof profile[key] === "string") {
                field.value = profile[key];
            }
        });

        updateProfilePreview(profile);
    }

    profileForm?.addEventListener("submit", (event) => {
        event.preventDefault();

        const displayName = cleanText(profileFields.displayName?.value, 60);
        const emailAddress = cleanText(profileFields.emailAddress?.value, 254);
        const phoneNumber = cleanText(profileFields.phoneNumber?.value, 25);
        const country = cleanText(profileFields.country?.value, 60);

        const nameValid = displayName.length >= 2;
        const emailValid = validEmail(emailAddress);

        setFieldError(profileFields.displayName, !nameValid);
        setFieldError(profileFields.emailAddress, !emailValid);

        if (!nameValid) {
            showToast(
                "Check your display name",
                "Enter a display name with at least 2 characters.",
                "error"
            );
            profileFields.displayName?.focus();
            return;
        }

        if (!emailValid) {
            showToast(
                "Check your email address",
                "Enter a valid email address.",
                "error"
            );
            profileFields.emailAddress?.focus();
            return;
        }

        const profile = {
            displayName,
            emailAddress,
            phoneNumber,
            country
        };

        if (!writeStorage(STORAGE_KEYS.profile, profile)) return;

        updateProfilePreview(profile);

        showToast(
            "Profile saved",
            "Your profile preview has been updated in this browser."
        );
    });

    [profileFields.displayName, profileFields.emailAddress].forEach((field) => {
        field?.addEventListener("input", () => {
            setFieldError(field, false);
        });
    });

    loadProfile();

    /* -----------------------------------------
       Preferences
    ----------------------------------------- */

    const preferencesForm = $("#preferencesForm");
    const languageSelect = $("#language");
    const currencySelect = $("#currency");
    const dateFormatSelect = $("#dateFormat");

    function loadPreferences() {
        const preferences = getStoredObject(
            STORAGE_KEYS.preferences,
            DEFAULT_PREFERENCES
        );

        if (languageSelect) {
            languageSelect.value = preferences.language === "en" ? "en" : "en";
        }

        if (currencySelect) {
            const currencyExists = Array.from(currencySelect.options).some(
                (option) => option.value === preferences.currency
            );

            currencySelect.value = currencyExists
                ? preferences.currency
                : DEFAULT_PREFERENCES.currency;
        }

        if (dateFormatSelect) {
            const allowedFormats = [
                "DD/MM/YYYY",
                "MM/DD/YYYY",
                "YYYY-MM-DD"
            ];

            dateFormatSelect.value = allowedFormats.includes(preferences.dateFormat)
                ? preferences.dateFormat
                : DEFAULT_PREFERENCES.dateFormat;
        }
    }

    preferencesForm?.addEventListener("submit", (event) => {
        event.preventDefault();

        const preferences = {
            language: "en",
            currency: currencySelect?.value || "NGN",
            dateFormat: dateFormatSelect?.value || "DD/MM/YYYY"
        };

        if (
            !currencySelect?.querySelector(`option[value="${CSS.escape(preferences.currency)}"]`) ||
            !["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].includes(preferences.dateFormat)
        ) {
            showToast(
                "Invalid preference",
                "Choose one of the available currency and date formats.",
                "error"
            );
            return;
        }

        if (writeStorage(STORAGE_KEYS.preferences, preferences)) {
            showToast(
                "Preferences saved",
                "Your display preferences have been saved in this browser."
            );
        }
    });

    loadPreferences();

    /* -----------------------------------------
       Notification preferences
    ----------------------------------------- */

    const notificationInputs = $$("[data-notification]");
    const saveNotificationsButton = $("#saveNotifications");
    const toggleAllNotifications = $("#toggleAllNotifications");

    function getNotificationValues() {
        const stored = getStoredObject(
            STORAGE_KEYS.notifications,
            DEFAULT_NOTIFICATIONS
        );

        const result = {};

        Object.keys(DEFAULT_NOTIFICATIONS).forEach((key) => {
            result[key] = typeof stored[key] === "boolean"
                ? stored[key]
                : DEFAULT_NOTIFICATIONS[key];
        });

        return result;
    }

    function updateNotificationControls() {
        const values = getNotificationValues();

        notificationInputs.forEach((input) => {
            const key = input.dataset.notification;

            if (Object.hasOwn(values, key)) {
                input.checked = values[key];
            }
        });

        updateToggleAllLabel();
    }

    function collectNotificationValues() {
        const values = {};

        notificationInputs.forEach((input) => {
            values[input.dataset.notification] = input.checked;
        });

        return values;
    }

    function updateToggleAllLabel() {
        if (!toggleAllNotifications || notificationInputs.length === 0) return;

        const allEnabled = notificationInputs.every((input) => input.checked);

        toggleAllNotifications.textContent = allEnabled
            ? "Disable all"
            : "Enable all";
    }

    notificationInputs.forEach((input) => {
        input.addEventListener("change", updateToggleAllLabel);
    });

    toggleAllNotifications?.addEventListener("click", () => {
        const shouldEnable = notificationInputs.some((input) => !input.checked);

        notificationInputs.forEach((input) => {
            input.checked = shouldEnable;
        });

        updateToggleAllLabel();
    });

    saveNotificationsButton?.addEventListener("click", () => {
        const values = collectNotificationValues();

        if (writeStorage(STORAGE_KEYS.notifications, values)) {
            showToast(
                "Notifications saved",
                "Your local notification preferences have been updated."
            );
        }
    });

    updateNotificationControls();

    /* -----------------------------------------
       Password visibility controls
    ----------------------------------------- */

    $$("[data-password-target]").forEach((button) => {
        button.addEventListener("click", () => {
            const target = document.getElementById(
                button.dataset.passwordTarget
            );

            if (!target) return;

            const reveal = target.type === "password";
            target.type = reveal ? "text" : "password";

            const icon = $("i", button);

            if (icon) {
                icon.className = reveal ? "bx bx-hide" : "bx bx-show";
            }

            button.setAttribute(
                "aria-label",
                `${reveal ? "Hide" : "Show"} ${target.id === "currentPassword"
                    ? "current password"
                    : target.id === "newPassword"
                        ? "new password"
                        : "password confirmation"}`
            );
        });
    });

    /* -----------------------------------------
       Password form validation
       Never store or transmit password values.
    ----------------------------------------- */

    const passwordForm = $("#passwordForm");
    const currentPassword = $("#currentPassword");
    const newPassword = $("#newPassword");
    const confirmPassword = $("#confirmPassword");

    function clearPasswordValues() {
        [currentPassword, newPassword, confirmPassword].forEach((field) => {
            if (field) field.value = "";
        });
    }

    passwordForm?.addEventListener("submit", (event) => {
        event.preventDefault();

        const currentValue = currentPassword?.value || "";
        const newValue = newPassword?.value || "";
        const confirmValue = confirmPassword?.value || "";

        if (!currentValue || !newValue || !confirmValue) {
            showToast(
                "Complete all fields",
                "Enter all three password fields to continue validation.",
                "error"
            );
            return;
        }

        if (newValue.length < 8) {
            showToast(
                "Password too short",
                "Your new password must contain at least 8 characters.",
                "error"
            );
            newPassword?.focus();
            return;
        }

        if (newValue === currentValue) {
            showToast(
                "Choose a different password",
                "Your new password must be different from your current password.",
                "error"
            );
            newPassword?.focus();
            return;
        }

        if (newValue !== confirmValue) {
            showToast(
                "Passwords do not match",
                "Check the new password and confirmation fields.",
                "error"
            );
            confirmPassword?.focus();
            return;
        }

        // Intentionally do not save or submit passwords.
        clearPasswordValues();

        showModal({
            title: "Backend connection required",
            message:
                "The password fields passed basic validation, but no password has been changed. Connect a secure authentication backend to verify the current password and update your account securely.",
            icon: "bx-info-circle",
            confirmText: "",
            onConfirm: null
        });
    });

    /* -----------------------------------------
       Modal controls
    ----------------------------------------- */

    const modal = $("#confirmationModal");
    const modalTitle = $("#modalTitle");
    const modalMessage = $("#modalMessage");
    const modalIcon = $("#modalIcon");
    const modalCancel = $("#modalCancel");
    const modalConfirm = $("#modalConfirm");

    let modalPreviousFocus = null;
    let modalConfirmAction = null;

    function showModal({
        title,
        message,
        icon = "bx-info-circle",
        danger = false,
        confirmText = "",
        onConfirm = null
    }) {
        if (!modal) return;

        modalPreviousFocus = document.activeElement;
        modalConfirmAction = typeof onConfirm === "function" ? onConfirm : null;

        if (modalTitle) modalTitle.textContent = title;
        if (modalMessage) modalMessage.textContent = message;

        if (modalIcon) {
            modalIcon.className = `modal-icon${danger ? " danger" : ""}`;

            const iconElement = $("i", modalIcon);

            if (iconElement) {
                iconElement.className = `bx ${icon}`;
            }
        }

        if (modalConfirm) {
            modalConfirm.hidden = !confirmText;
            modalConfirm.textContent = confirmText || "Confirm";
        }

        modal.hidden = false;
        document.body.style.overflow = "hidden";
        modalCancel?.focus();
    }

    function closeModal() {
        if (!modal || modal.hidden) return;

        modal.hidden = true;
        document.body.style.overflow = sidebar?.classList.contains("open")
            ? "hidden"
            : "";

        modalConfirmAction = null;

        if (modalPreviousFocus && typeof modalPreviousFocus.focus === "function") {
            modalPreviousFocus.focus();
        }
    }

    modalCancel?.addEventListener("click", closeModal);

    modalConfirm?.addEventListener("click", () => {
        const action = modalConfirmAction;

        closeModal();

        if (action) action();
    });

    modal?.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
    });

    /* -----------------------------------------
       Account actions
    ----------------------------------------- */

    $("#signOutButton")?.addEventListener("click", () => {
        showModal({
            title: "Sign-out unavailable",
            message:
                "There is no authentication session connected to this frontend page. No one has been signed out. Connect your authentication provider to implement a real sign-out action.",
            icon: "bx-log-out"
        });
    });

    $("#deleteAccountButton")?.addEventListener("click", () => {
        showModal({
            title: "Account deletion unavailable",
            message:
                "This page cannot delete an account or erase account data. No deletion has been performed. A secure backend must verify the authenticated user, explain the consequences, and handle deletion of associated data.",
            icon: "bx-trash-alt",
            danger: true
        });
    });

    /* -----------------------------------------
       Keyboard behavior
    ----------------------------------------- */

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (modal && !modal.hidden) {
                closeModal();
            } else {
                closeSidebar();
            }
        }

        // Keep keyboard focus inside the open modal.
        if (event.key === "Tab" && modal && !modal.hidden) {
            const focusable = $$(
                'button:not([hidden]):not(:disabled), [href], input:not([disabled]), select:not([disabled])',
                modal
            ).filter((element) => element.getClientRects().length > 0);

            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    /* -----------------------------------------
       Footer
    ----------------------------------------- */

    const currentYear = $("#currentYear");

    if (currentYear) {
        currentYear.textContent = String(new Date().getFullYear());
    }
});