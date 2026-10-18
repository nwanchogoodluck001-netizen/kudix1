
"use strict";

/* =========================================================
   KUDIX DASHBOARD
   Frontend interactions only.
   Secure authentication and account data require a backend.
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const root = document.documentElement;
    const body = document.body;

    const config = window.KUDIX_CONFIG || {};

    /* =====================================================
       ELEMENT REFERENCES
       ===================================================== */

    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");

    const sidebar = document.getElementById("sidebar");
    const sidebarBackdrop = document.getElementById("sidebarBackdrop");
    const sidebarClose = document.getElementById("sidebarClose");
    const mobileMenuButton = document.getElementById("mobileMenuButton");

    const notificationToggle = document.getElementById("notificationToggle");
    const notificationDropdown = document.getElementById("notificationDropdown");

    const profileToggle = document.getElementById("profileToggle");
    const profileDropdown = document.getElementById("profileDropdown");

    const welcomeModal = document.getElementById("welcomeModal");
    const welcomeClose = document.getElementById("welcomeClose");
    const exploreDashboardButton = document.getElementById(
        "exploreDashboardButton"
    );

    const joinChannelButton = document.getElementById("joinChannelButton");
    const channelUnavailableMessage = document.getElementById(
        "channelUnavailableMessage"
    );

    const logoutButton = document.getElementById("logoutButton");
    const profileLogoutButton = document.getElementById(
        "profileLogoutButton"
    );

    const dashboardToast = document.getElementById("dashboardToast");

    let toastTimer = null;
    let previousFocus = null;
    let welcomeOpened = false;

    /* =====================================================
       SAFE STORAGE HELPERS
       ===================================================== */

    function readStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            // The interface still works if browser storage is unavailable.
        }
    }

    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            // No action needed.
        }
    }

    /* =====================================================
       THEME
       ===================================================== */

    const systemThemeQuery = window.matchMedia(
        "(prefers-color-scheme: dark)"
    );

    function getPreferredTheme() {
        const savedTheme = readStorage("kudix-theme");

        if (savedTheme === "light" || savedTheme === "dark") {
            return savedTheme;
        }

        return systemThemeQuery.matches ? "dark" : "light";
    }

    function applyTheme(theme, persist = true) {
        const selectedTheme = theme === "dark" ? "dark" : "light";

        root.dataset.theme = selectedTheme;

        if (themeToggle && themeIcon) {
            const darkMode = selectedTheme === "dark";

            themeIcon.className = darkMode
                ? "bx bx-sun"
                : "bx bx-moon";

            themeToggle.setAttribute(
                "aria-label",
                darkMode ? "Switch to light mode" : "Switch to dark mode"
            );

            themeToggle.setAttribute(
                "title",
                darkMode ? "Switch to light mode" : "Switch to dark mode"
            );

            themeToggle.setAttribute(
                "aria-pressed",
                String(darkMode)
            );
        }

        if (persist) {
            writeStorage("kudix-theme", selectedTheme);
        }
    }

    applyTheme(getPreferredTheme(), false);

    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            const currentTheme = root.dataset.theme;
            const nextTheme = currentTheme === "dark" ? "light" : "dark";

            applyTheme(nextTheme, true);
        });
    }

    if (systemThemeQuery.addEventListener) {
        systemThemeQuery.addEventListener("change", function (event) {
            const savedTheme = readStorage("kudix-theme");

            if (!savedTheme) {
                applyTheme(event.matches ? "dark" : "light", false);
            }
        });
    }

    /* =====================================================
       DATE AND COPYRIGHT
       ===================================================== */

    const copyrightYear = document.getElementById("copyrightYear");
    const dashboardDate = document.getElementById("dashboardDate");

    const currentDate = new Date();

    if (copyrightYear) {
        copyrightYear.textContent = currentDate.getFullYear();
    }

    document.querySelectorAll(".current-year").forEach(function (element) {
        element.textContent = currentDate.getFullYear();
    });

    if (dashboardDate) {
        dashboardDate.textContent = currentDate.toLocaleDateString(
            undefined,
            {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
            }
        ).toUpperCase();
    }

    /* =====================================================
       ACCOUNT PLACEHOLDERS
       ===================================================== */

    /*
       When authentication is integrated, replace these neutral
       placeholders with verified account data from your backend.

       Do not read an account identity from arbitrary localStorage
       values and treat that as proof of authentication.
    */

    const accountName = "KUDIX Member";

    const sidebarUsername = document.getElementById("sidebarUsername");
    const topbarUsername = document.getElementById("topbarUsername");
    const dropdownUsername = document.getElementById("dropdownUsername");

    [sidebarUsername, topbarUsername, dropdownUsername].forEach(
        function (element) {
            if (element) {
                element.textContent = accountName;
            }
        }
    );

    /* =====================================================
       MOBILE SIDEBAR
       ===================================================== */

    function openSidebar() {
        body.classList.add("sidebar-open");

        if (mobileMenuButton) {
            mobileMenuButton.setAttribute("aria-expanded", "true");
        }

        if (sidebarClose) {
            sidebarClose.focus();
        }
    }

    function closeSidebar(restoreFocus = true) {
        body.classList.remove("sidebar-open");

        if (mobileMenuButton) {
            mobileMenuButton.setAttribute("aria-expanded", "false");

            if (restoreFocus) {
                mobileMenuButton.focus();
            }
        }
    }

    if (mobileMenuButton) {
        mobileMenuButton.addEventListener("click", function () {
            if (body.classList.contains("sidebar-open")) {
                closeSidebar(false);
            } else {
                openSidebar();
            }
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener("click", function () {
            closeSidebar();
        });
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener("click", function () {
            closeSidebar();
        });
    }

    if (sidebar) {
        sidebar.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                if (window.innerWidth <= 760) {
                    closeSidebar(false);
                }
            });
        });
    }

    window.addEventListener("resize", function () {
        if (window.innerWidth > 760) {
            closeSidebar(false);
        }
    });

    /* =====================================================
       DROPDOWNS
       ===================================================== */

    const dropdowns = [
        {
            trigger: notificationToggle,
            panel: notificationDropdown
        },
        {
            trigger: profileToggle,
            panel: profileDropdown
        }
    ];

    function closeDropdown(dropdown, restoreFocus = false) {
        if (!dropdown || !dropdown.trigger || !dropdown.panel) {
            return;
        }

        dropdown.panel.hidden = true;
        dropdown.trigger.setAttribute("aria-expanded", "false");

        if (restoreFocus) {
            dropdown.trigger.focus();
        }
    }

    function closeAllDropdowns(except = null) {
        dropdowns.forEach(function (dropdown) {
            if (dropdown !== except) {
                closeDropdown(dropdown, false);
            }
        });
    }

    function toggleDropdown(dropdown) {
        if (!dropdown || !dropdown.trigger || !dropdown.panel) {
            return;
        }

        const willOpen = dropdown.panel.hidden;

        closeAllDropdowns(dropdown);

        dropdown.panel.hidden = !willOpen;

        dropdown.trigger.setAttribute(
            "aria-expanded",
            String(willOpen)
        );
    }

    dropdowns.forEach(function (dropdown) {
        if (!dropdown.trigger || !dropdown.panel) {
            return;
        }

        dropdown.trigger.addEventListener("click", function () {
            toggleDropdown(dropdown);
        });

        dropdown.panel.querySelectorAll("[data-close-dropdown]").forEach(
            function (button) {
                button.addEventListener("click", function () {
                    closeDropdown(dropdown, true);
                });
            }
        );
    });

    document.addEventListener("click", function (event) {
        dropdowns.forEach(function (dropdown) {
            if (
                !dropdown.trigger ||
                !dropdown.panel ||
                dropdown.panel.hidden
            ) {
                return;
            }

            const clickedTrigger = dropdown.trigger.contains(event.target);
            const clickedPanel = dropdown.panel.contains(event.target);

            if (!clickedTrigger && !clickedPanel) {
                closeDropdown(dropdown, false);
            }
        });
    });

    /* =====================================================
       WELCOME MODAL
       ===================================================== */

    const WELCOME_STORAGE_KEY = "kudix-welcome-dismissed";

    function getFocusableElements(container) {
        if (!container) {
            return [];
        }

        return Array.from(
            container.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), ' +
                'select:not([disabled]), textarea:not([disabled]), ' +
                '[tabindex]:not([tabindex="-1"])'
            )
        ).filter(function (element) {
            return element.getClientRects().length > 0;
        });
    }

    function openWelcomeModal() {
        if (!welcomeModal || welcomeOpened) {
            return;
        }

        welcomeOpened = true;
        previousFocus = document.activeElement;

        welcomeModal.hidden = false;
        welcomeModal.setAttribute("aria-hidden", "false");

        body.classList.add("modal-open");

        closeAllDropdowns();

        window.requestAnimationFrame(function () {
            if (welcomeClose) {
                welcomeClose.focus();
            }
        });
    }

    function closeWelcomeModal() {
        if (!welcomeModal || welcomeModal.hidden) {
            return;
        }

        welcomeModal.hidden = true;
        welcomeModal.setAttribute("aria-hidden", "true");

        body.classList.remove("modal-open");

        writeStorage(WELCOME_STORAGE_KEY, "true");

        if (
            previousFocus &&
            typeof previousFocus.focus === "function" &&
            document.contains(previousFocus)
        ) {
            previousFocus.focus();
        } else if (exploreDashboardButton) {
            exploreDashboardButton.focus();
        }
    }

    if (welcomeClose) {
        welcomeClose.addEventListener("click", closeWelcomeModal);
    }

    if (exploreDashboardButton) {
        exploreDashboardButton.addEventListener(
            "click",
            closeWelcomeModal
        );
    }

    if (welcomeModal) {
        welcomeModal.querySelectorAll("[data-welcome-close]").forEach(
            function (element) {
                element.addEventListener("click", closeWelcomeModal);
            }
        );
    }

    /*
       A lightweight keyboard focus trap keeps keyboard navigation
       within the modal while it is open.
    */
    document.addEventListener("keydown", function (event) {
        if (!welcomeModal || welcomeModal.hidden) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeWelcomeModal();
            return;
        }

        if (event.key !== "Tab") {
            return;
        }

        const focusableElements = getFocusableElements(welcomeModal);

        if (!focusableElements.length) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (
            event.shiftKey &&
            document.activeElement === firstElement
        ) {
            event.preventDefault();
            lastElement.focus();
        } else if (
            !event.shiftKey &&
            document.activeElement === lastElement
        ) {
            event.preventDefault();
            firstElement.focus();
        }
    });

    /*
       Show the welcome popup if the user has not dismissed it.
       This is a presentation preference, not authentication.
    */
    // Show the welcome popup whenever the dashboard loads.
    window.setTimeout(openWelcomeModal, 300);

    

    /* =====================================================
       WHATSAPP & TELEGRAM COMMUNITY LINKS
       ===================================================== */

    function configureCommunityLinks() {
        const whatsappButton = document.getElementById("joinWhatsAppButton");
        const telegramButton = document.getElementById("joinTelegramButton");
        const unavailableMessage = document.getElementById(
            "channelUnavailableMessage"
        );

        const links = [
            {
                button: whatsappButton,
                url: config.whatsappUrl || "",
                name: "WhatsApp"
            },
            {
                button: telegramButton,
                url: config.telegramUrl || "",
                name: "Telegram"
            }
        ];

        let availableCount = 0;

        links.forEach(function (item) {
            if (!item.button) {
                return;
            }

            let validUrl = false;

            try {
                const parsedUrl = new URL(String(item.url).trim());

                validUrl =
                    parsedUrl.protocol === "https:" &&
                    Boolean(parsedUrl.hostname);

                if (validUrl) {
                    item.button.href = parsedUrl.href;
                    item.button.removeAttribute("aria-disabled");
                    item.button.removeAttribute("tabindex");
                    availableCount++;
                }
            } catch (error) {
                validUrl = false;
            }

            if (!validUrl) {
                item.button.href = "#";
                item.button.setAttribute("aria-disabled", "true");
                item.button.setAttribute("tabindex", "-1");

                item.button.onclick = function (event) {
                    event.preventDefault();

                    showToast(
                        item.name + " community link is not configured yet."
                    );
                };
            } else {
                item.button.onclick = null;
            }
        });

        if (unavailableMessage) {
            unavailableMessage.hidden = availableCount === links.length;

            if (availableCount === 0) {
                unavailableMessage.textContent =
                    "Official WhatsApp and Telegram links will be available here soon.";
            } else if (availableCount === 1) {
                unavailableMessage.textContent =
                    "One official community link is still unavailable.";
            }
        }
    }

    configureCommunityLinks();




    /* =====================================================
       FRONTEND-ONLY ACTION FEEDBACK
       ===================================================== */

    function showToast(message) {
        if (!dashboardToast) {
            return;
        }

        dashboardToast.textContent = message;
        dashboardToast.hidden = false;

        if (toastTimer) {
            window.clearTimeout(toastTimer);
        }

        toastTimer = window.setTimeout(function () {
            dashboardToast.hidden = true;
        }, 3500);
    }

    /*
       Logout is intentionally not simulated.
       Connect these controls to the real authentication provider.
    */
    function handleLogoutRequest() {
        showToast(
            "Secure sign-out is not connected yet. Connect your authentication provider to enable logout."
        );

        closeAllDropdowns();
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", handleLogoutRequest);
    }

    if (profileLogoutButton) {
        profileLogoutButton.addEventListener("click", handleLogoutRequest);
    }

    /* =====================================================
       GLOBAL ESCAPE HANDLING
       ===================================================== */

    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") {
            return;
        }

        closeAllDropdowns();

        if (body.classList.contains("sidebar-open")) {
            closeSidebar();
        }
    });

});





function updateKudixGreeting() {
    const greetingTime = document.getElementById("greetingTime");
    const greetingName = document.getElementById("greetingName");
    const dashboardDate = document.getElementById("dashboardDate");

    const hour = new Date().getHours();

    let greeting = "Good evening";

    if (hour >= 5 && hour < 12) {
        greeting = "Good morning";
    } else if (hour >= 12 && hour < 17) {
        greeting = "Good afternoon";
    }

    if (greetingTime) {
        greetingTime.textContent = greeting;
    }

    if (dashboardDate) {
        dashboardDate.textContent = new Date().toLocaleDateString(
            undefined,
            {
                weekday: "long",
                month: "long",
                day: "numeric"
            }
        );
    }

    // Use your existing username display logic if it already sets this.
    if (greetingName && !greetingName.textContent.trim()) {
        greetingName.textContent =
            localStorage.getItem("kudixUsername") ||
            localStorage.getItem("username") ||
            "Player";
    }
}

updateKudixGreeting();

