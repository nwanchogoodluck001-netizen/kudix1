/* =========================================================
   KUDIX GAMES PAGE
   Vanilla JavaScript
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    "use strict";


    // =====================================================
    // ELEMENTS
    // =====================================================

    const html = document.documentElement;

    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = document.getElementById("themeIcon");

    const sidebar = document.getElementById("sidebar");
    const openSidebarButton = document.getElementById("openSidebar");
    const closeSidebarButton = document.getElementById("closeSidebar");
    const mobileOverlay = document.getElementById("mobileOverlay");

    const gameSearch = document.getElementById("gameSearch");
    const filterButtons = document.querySelectorAll(".filter-button");
    const gameCards = document.querySelectorAll(".game-card");

    const visibleGameCount = document.getElementById("visibleGameCount");
    const emptyState = document.getElementById("emptyState");
    const resetSearchButton = document.getElementById("resetSearch");

    const exploreAllGamesButton = document.getElementById("exploreAllGames");

    const gameModal = document.getElementById("gameModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalDescription = document.getElementById("modalDescription");

    const closeGameModalButton = document.getElementById("closeGameModal");
    const modalOkayButton = document.getElementById("modalOkay");

    const toastNotification = document.getElementById("toastNotification");
    const toastMessage = document.getElementById("toastMessage");

    const currentYear = document.getElementById("currentYear");


    // =====================================================
    // THEME MANAGEMENT
    // =====================================================

    function getCurrentTheme() {
        return html.getAttribute("data-theme") === "dark"
            ? "dark"
            : "light";
    }


    function updateThemeButton() {

        if (!themeToggle || !themeIcon) {
            return;
        }

        const currentTheme = getCurrentTheme();

        if (currentTheme === "dark") {

            themeIcon.className = "bx bx-sun";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to light mode"
            );

            themeToggle.setAttribute(
                "title",
                "Switch to light mode"
            );

        } else {

            themeIcon.className = "bx bx-moon";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to dark mode"
            );

            themeToggle.setAttribute(
                "title",
                "Switch to dark mode"
            );
        }
    }


    function saveTheme(theme) {

        try {
            localStorage.setItem("kudix-theme", theme);
        } catch (error) {
            // The page remains functional if storage is unavailable.
        }
    }


    function setTheme(theme) {

        const selectedTheme = theme === "dark"
            ? "dark"
            : "light";

        html.setAttribute("data-theme", selectedTheme);

        saveTheme(selectedTheme);
        updateThemeButton();
    }


    updateThemeButton();


    if (themeToggle) {

        themeToggle.addEventListener("click", function () {

            const nextTheme = getCurrentTheme() === "dark"
                ? "light"
                : "dark";

            setTheme(nextTheme);

        });
    }


    // =====================================================
    // MOBILE SIDEBAR
    // =====================================================

    function isMobileNavigation() {
        return window.matchMedia("(max-width: 900px)").matches;
    }


    function openSidebar() {

        if (!sidebar) {
            return;
        }

        sidebar.classList.add("open");

        if (mobileOverlay) {
            mobileOverlay.classList.add("show");
        }

        document.body.style.overflow = "hidden";

        if (openSidebarButton) {
            openSidebarButton.setAttribute("aria-expanded", "true");
        }

        if (closeSidebarButton) {
            closeSidebarButton.focus();
        }
    }


    function closeSidebar() {

        if (!sidebar) {
            return;
        }

        sidebar.classList.remove("open");

        if (mobileOverlay) {
            mobileOverlay.classList.remove("show");
        }

        document.body.style.overflow = "";

        if (openSidebarButton) {
            openSidebarButton.setAttribute("aria-expanded", "false");
        }
    }


    if (openSidebarButton) {

        openSidebarButton.addEventListener("click", function () {

            if (sidebar && sidebar.classList.contains("open")) {
                closeSidebar();
            } else {
                openSidebar();
            }

        });
    }


    if (closeSidebarButton) {
        closeSidebarButton.addEventListener("click", closeSidebar);
    }


    if (mobileOverlay) {
        mobileOverlay.addEventListener("click", closeSidebar);
    }


    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            closeSidebar();

            if (gameModal && !gameModal.hidden) {
                closeGameModal();
            }
        }

    });


    window.addEventListener("resize", function () {

        if (!isMobileNavigation()) {
            closeSidebar();
        }

    });


    // Close the sidebar after choosing a navigation link on mobile.
    document.querySelectorAll(".sidebar-nav a, .support-link").forEach(function (link) {

        link.addEventListener("click", function () {

            if (isMobileNavigation()) {
                closeSidebar();
            }

        });

    });


    // =====================================================
    // GAME FILTERS AND SEARCH
    // =====================================================

    let activeFilter = "all";


    function getSearchTerm() {

        if (!gameSearch) {
            return "";
        }

        return gameSearch.value
            .trim()
            .toLowerCase();
    }


    function updateGames() {

        const searchTerm = getSearchTerm();
        let visibleCount = 0;

        gameCards.forEach(function (card) {

            const category = card.dataset.category || "";

            const searchableText = (
                (card.dataset.search || "") + " " +
                (card.querySelector("h3")?.textContent || "") + " " +
                (card.querySelector(".game-card-body p")?.textContent || "")
            ).toLowerCase();

            const matchesCategory =
                activeFilter === "all" ||
                category === activeFilter;

            const matchesSearch =
                searchTerm === "" ||
                searchableText.includes(searchTerm);

            const shouldShow = matchesCategory && matchesSearch;

            card.hidden = !shouldShow;

            if (shouldShow) {
                visibleCount++;
            }

        });


        if (visibleGameCount) {
            visibleGameCount.textContent = visibleCount;
        }


        if (emptyState) {
            emptyState.hidden = visibleCount !== 0;
        }

    }


    filterButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            activeFilter = button.dataset.filter || "all";

            filterButtons.forEach(function (filterButton) {

                const isActive = filterButton === button;

                filterButton.classList.toggle("active", isActive);

                filterButton.setAttribute(
                    "aria-pressed",
                    String(isActive)
                );

            });

            updateGames();

        });

    });


    if (gameSearch) {

        gameSearch.addEventListener("input", updateGames);

    }


    // Keyboard shortcut: "/" focuses the game search field.
    document.addEventListener("keydown", function (event) {

        const target = event.target;

        const isTyping =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target.isContentEditable;

        if (
            event.key === "/" &&
            !isTyping &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {

            event.preventDefault();

            if (gameSearch) {
                gameSearch.focus();
            }

        }

    });


    // =====================================================
    // RESET FILTERS
    // =====================================================

    function resetGameFilters() {

        activeFilter = "all";

        if (gameSearch) {
            gameSearch.value = "";
        }

        filterButtons.forEach(function (button) {

            const isAllGames = button.dataset.filter === "all";

            button.classList.toggle("active", isAllGames);

            button.setAttribute(
                "aria-pressed",
                String(isAllGames)
            );

        });

        updateGames();

    }


    if (resetSearchButton) {

        resetSearchButton.addEventListener("click", function () {

            resetGameFilters();

            if (gameSearch) {
                gameSearch.focus();
            }

        });

    }


    if (exploreAllGamesButton) {

        exploreAllGamesButton.addEventListener("click", function () {

            resetGameFilters();

            const gamesSection = document.getElementById("gamesSection");

            if (gamesSection) {

                gamesSection.scrollIntoView({
                    behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches ? "auto" : "smooth",
                    block: "start"
                });

            }

        });

    }


    // =====================================================
    // GAME INFORMATION MODAL
    // =====================================================

    let lastFocusedElement = null;


    const gameDescriptions = {

        "Colour Prediction":
            "Explore the Colour Prediction game concept. Review the game rules, available features, and eligibility requirements before participating.",

        "Number Prediction":
            "Explore the Number Prediction game concept and learn how number-based challenges work.",

        "Heads or Tails":
            "Explore a classic heads-or-tails challenge. Review the rules and understand how outcomes are determined.",

        "Up or Down":
            "Explore the Up or Down challenge and learn how directional choices work.",

        "Lucky Number":
            "Explore the Lucky Number game concept and review its rules and available features.",

        "Higher or Lower":
            "Explore the Higher or Lower challenge and learn how values are compared."
    };


    function openGameModal(gameName) {

        if (!gameModal || !modalTitle || !modalDescription) {
            return;
        }

        lastFocusedElement = document.activeElement;

        modalTitle.textContent = gameName;

        modalDescription.textContent =
            gameDescriptions[gameName] ||
            "More information about this game will be available here.";

        gameModal.hidden = false;

        document.body.style.overflow = "hidden";

        if (closeGameModalButton) {
            closeGameModalButton.focus();
        }

    }


    function closeGameModal() {

        if (!gameModal || gameModal.hidden) {
            return;
        }

        gameModal.hidden = true;

        document.body.style.overflow = "";

        if (
            lastFocusedElement &&
            typeof lastFocusedElement.focus === "function"
        ) {
            lastFocusedElement.focus();
        }

    }


    document.querySelectorAll(".play-button").forEach(function (button) {

        button.addEventListener("click", function () {

            const gameName = button.dataset.game || "Game";

            openGameModal(gameName);

        });

    });


    if (closeGameModalButton) {

        closeGameModalButton.addEventListener(
            "click",
            closeGameModal
        );

    }


    if (modalOkayButton) {

        modalOkayButton.addEventListener(
            "click",
            closeGameModal
        );

    }


    if (gameModal) {

        gameModal.addEventListener("click", function (event) {

            if (event.target === gameModal) {
                closeGameModal();
            }

        });

    }


    // =====================================================
    // TOAST NOTIFICATIONS
    // =====================================================

    let toastTimeout;


    function showToast(message) {

        if (!toastNotification || !toastMessage) {
            return;
        }

        toastMessage.textContent = message;

        toastNotification.classList.add("show");

        clearTimeout(toastTimeout);

        toastTimeout = setTimeout(function () {

            toastNotification.classList.remove("show");

        }, 3000);

    }


    // =====================================================
    // FOOTER YEAR
    // =====================================================

    if (currentYear) {

        currentYear.textContent = new Date().getFullYear();

    }


    // =====================================================
    // INITIALISE PAGE
    // =====================================================

    updateGames();

    /*
       This page is a frontend interface.

       - Game cards display informational modals until their
         actual game pages are implemented.
       - Promotional credit is not verified account data.
       - Authentication, eligibility, transactions and real
         rewards require a properly connected backend.
       - Theme preference is the only data stored locally.
    */

});