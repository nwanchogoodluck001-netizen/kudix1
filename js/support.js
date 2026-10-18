"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));

    const THEME_KEY = "kudix-theme";
    const PROFILE_KEY = "kudix-settings-profile";

    /*
     * Replace the empty strings with your official Telegram URLs.
     * Example: "https://t.me/YourOfficialSupportUsername"
     *
     * Keep them empty until you have verified the correct contacts.
     */
    const SUPPORT_CONTACTS = {
        1: "",
        2: "",
        3: ""
    };

    /* Toast messages */

    function showToast(title, message, type = "success") {
        const container = $("#toastContainer");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast${type === "error" ? " error" : ""}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");

        const icon = document.createElement("i");
        icon.className = type === "error"
            ? "bx bx-error-circle"
            : "bx bx-info-circle";

        const content = document.createElement("div");
        const heading = document.createElement("strong");
        const description = document.createElement("p");

        heading.textContent = title;
        description.textContent = message;

        content.append(heading, description);
        toast.append(icon, content);
        container.appendChild(toast);

        window.setTimeout(() => toast.remove(), 4500);
    }

    /* Theme toggle */

    const themeToggle = $("#themeToggle");

    function getSavedTheme() {
        try {
            const theme = localStorage.getItem(THEME_KEY);
            return theme === "light" ? "light" : "dark";
        } catch {
            return "dark";
        }
    }

    function applyTheme(theme, save = true) {
        const safeTheme = theme === "light" ? "light" : "dark";

        document.body.classList.toggle("light-theme", safeTheme === "light");
        document.body.classList.toggle("dark-theme", safeTheme === "dark");

        document.documentElement.dataset.theme = safeTheme;
        document.documentElement.style.colorScheme = safeTheme;

        if (themeToggle) {
            const icon = $("i", themeToggle);
            const nextTheme = safeTheme === "dark" ? "light" : "dark";

            if (icon) {
                icon.className = safeTheme === "dark"
                    ? "bx bx-sun"
                    : "bx bx-moon";
            }

            themeToggle.setAttribute(
                "aria-label",
                `Switch to ${nextTheme} theme`
            );

            themeToggle.title = `Switch to ${nextTheme} theme`;
        }

        if (save) {
            try {
                localStorage.setItem(THEME_KEY, safeTheme);
            } catch {
                showToast(
                    "Theme not saved",
                    "Your theme changed for this visit, but your browser could not save it.",
                    "error"
                );
            }
        }
    }

    applyTheme(getSavedTheme(), false);

    themeToggle?.addEventListener("click", () => {
        const isLight = document.body.classList.contains("light-theme");
        applyTheme(isLight ? "dark" : "light");
    });

    /* Profile preview: use actual saved profile only */

    try {
        const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");

        if (profile && typeof profile === "object") {
            const name = typeof profile.displayName === "string"
                ? profile.displayName.trim().slice(0, 60)
                : "";

            if (name) {
                const nameElement = $("#topProfileName");
                const avatarElement = $("#topAvatar");

                if (nameElement) nameElement.textContent = name;
                if (avatarElement) {
                    avatarElement.textContent = Array.from(name)[0].toUpperCase();
                }
            }
        }
    } catch {
        // Keep the neutral default profile display.
    }

    /* Mobile sidebar */

    const sidebar = $("#sidebar");
    const menuToggle = $("#menuToggle");
    const overlay = $("#sidebarOverlay");

    function openSidebar() {
        if (!sidebar) return;

        sidebar.classList.add("open");
        overlay?.classList.add("visible");
        menuToggle?.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar?.classList.remove("open");
        overlay?.classList.remove("visible");
        menuToggle?.setAttribute("aria-expanded", "false");

        if (!$("#infoModal")?.hidden) return;

        document.body.style.overflow = "";
    }

    menuToggle?.addEventListener("click", () => {
        sidebar?.classList.contains("open")
            ? closeSidebar()
            : openSidebar();
    });

    overlay?.addEventListener("click", closeSidebar);

    $$(".sidebar .nav-link").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) closeSidebar();
    });

    /* Information modal */

    const modal = $("#infoModal");
    const modalTitle = $("#infoModalTitle");
    const modalMessage = $("#infoModalMessage");
    const closeModalButton = $("#closeInfoModal");

    let previousFocus = null;

    function openInfoModal(title, message) {
        if (!modal) return;

        previousFocus = document.activeElement;

        if (modalTitle) modalTitle.textContent = title;
        if (modalMessage) modalMessage.textContent = message;

        modal.hidden = false;
        document.body.style.overflow = "hidden";
        closeModalButton?.focus();
    }

    function closeInfoModal() {
        if (!modal || modal.hidden) return;

        modal.hidden = true;

        if (sidebar?.classList.contains("open")) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        if (previousFocus && typeof previousFocus.focus === "function") {
            previousFocus.focus();
        }
    }

    closeModalButton?.addEventListener("click", closeInfoModal);

    modal?.addEventListener("click", (event) => {
        if (event.target === modal) closeInfoModal();
    });

    $("#chatInfoButton")?.addEventListener("click", () => {
        openInfoModal(
            "About KUDIX Support",
            "This page is the KUDIX support portal interface. The conversation shown is sample interface content, not a live support session. Use a verified support contact to reach the actual team."
        );
    });

    /* Telegram support buttons */

    $$("[data-agent]").forEach((button) => {
        button.addEventListener("click", () => {
            const agent = button.dataset.agent;
            const url = SUPPORT_CONTACTS[agent];

            if (!url) {
                showToast(
                    "Support link not configured",
                    `Add the verified Telegram URL for Support Agent ${agent} in js/support.js.`,
                    "error"
                );
                return;
            }

            /*
             * Only open a valid Telegram HTTPS URL.
             * Do not allow arbitrary protocols or destinations.
             */
            let parsedUrl;

            try {
                parsedUrl = new URL(url);
            } catch {
                showToast(
                    "Invalid support link",
                    "Check the Telegram URL configured for this support contact.",
                    "error"
                );
                return;
            }

            if (
                parsedUrl.protocol !== "https:" ||
                !["t.me", "telegram.me"].includes(parsedUrl.hostname.toLowerCase())
            ) {
                showToast(
                    "Invalid support link",
                    "Use a verified HTTPS Telegram link for this support contact.",
                    "error"
                );
                return;
            }

            const newWindow = window.open(
                parsedUrl.href,
                "_blank",
                "noopener,noreferrer"
            );

            if (newWindow) {
                newWindow.opener = null;
            }
        });
    });

    /* Escape key and modal focus */

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;

        if (modal && !modal.hidden) {
            closeInfoModal();
        } else {
            closeSidebar();
        }
    });

    /* Footer year */

    const yearElement = $("#currentYear");

    if (yearElement) {
        yearElement.textContent = String(new Date().getFullYear());
    }
});