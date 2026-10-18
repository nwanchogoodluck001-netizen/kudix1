"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const sidebar = $("#sidebar");
    const overlay = $("#sidebarOverlay");
    const menuToggle = $("#menuToggle");
    const themeToggle = $("#themeToggle");

    const modal = $("#levelUpModal");
    const modalPanel = $(".level-modal", modal);
    const closeModalButton = $("#closeModal");
    const maybeLaterButton = $("#maybeLater");
    const withdrawalForm = $("#withdrawalForm");

    let previousFocus = null;

    /* -----------------------------
       THEME
    ----------------------------- */

    const THEME_KEY = "kudix-theme";

    function readTheme() {
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

    applyTheme(readTheme());

    themeToggle?.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("light-theme")
            ? "dark"
            : "light";

        applyTheme(nextTheme);

        try {
            localStorage.setItem(THEME_KEY, nextTheme);
        } catch {
            // The theme still changes for this page session.
        }
    });

    window.addEventListener("storage", (event) => {
        if (event.key === THEME_KEY) {
            applyTheme(event.newValue === "light" ? "light" : "dark");
        }
    });

    /* -----------------------------
       MOBILE SIDEBAR
    ----------------------------- */

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

        if (modal?.hidden !== false) {
            document.body.style.overflow = "";
        }
    }

    menuToggle?.addEventListener("click", () => {
        if (sidebar?.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay?.addEventListener("click", closeSidebar);

    sidebar?.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) {
            closeSidebar();
        }
    });

    /* -----------------------------
       LEVEL-UP POP-UP
    ----------------------------- */

    function openLevelUpModal() {
        if (!modal) return;

        if (!modal.hidden) return;

        previousFocus = document.activeElement;

        modal.hidden = false;
        document.body.classList.add("modal-open");
        document.body.style.overflow = "hidden";

        closeModalButton?.focus();
    }

    function closeLevelUpModal() {
        if (!modal || modal.hidden) return;

        modal.hidden = true;
        document.body.classList.remove("modal-open");

        const sidebarOpen = sidebar?.classList.contains("open");

        document.body.style.overflow = sidebarOpen ? "hidden" : "";

        if (
            previousFocus &&
            typeof previousFocus.focus === "function" &&
            document.contains(previousFocus)
        ) {
            previousFocus.focus();
        } else {
            withdrawalForm?.querySelector("button[type='submit']")?.focus();
        }

        previousFocus = null;
    }

    /*
     * Important: do not validate the amount here.
     * Clicking Request Withdrawal should always display the level-up message.
     */
    withdrawalForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        openLevelUpModal();
    });

    closeModalButton?.addEventListener("click", closeLevelUpModal);
    maybeLaterButton?.addEventListener("click", closeLevelUpModal);

    /* Close by clicking the dark backdrop. */

    modal?.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeLevelUpModal();
        }
    });

    /* Escape closes the modal or mobile sidebar. */

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            if (modal && !modal.hidden) {
                closeLevelUpModal();
            } else {
                closeSidebar();
            }

            return;
        }

        /* Keep keyboard focus inside the open modal. */

        if (event.key === "Tab" && modal && !modal.hidden) {
            const focusable = Array.from(
                modalPanel.querySelectorAll(
                    'a[href], button:not([disabled]), input:not([disabled]), ' +
                    'select:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter((element) => element.getClientRects().length > 0);

            if (!focusable.length) {
                event.preventDefault();
                modalPanel?.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (
                !event.shiftKey &&
                document.activeElement === last
            ) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    /* -----------------------------
       WALLET SELECTOR
    ----------------------------- */

    const sourceWallet = $("#sourceWallet");

    sourceWallet?.addEventListener("change", () => {
        /*
         * Wallet options are illustrative in this frontend.
         * A real balance must come from your backend.
         */
        sourceWallet.setAttribute("aria-label", "Selected source wallet");
    });

    /* -----------------------------
       FOOTER
    ----------------------------- */

    const year = $("#currentYear");

    if (year) {
        year.textContent = String(new Date().getFullYear());
    }
});