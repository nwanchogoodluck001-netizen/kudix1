
"use strict";

/*
  KUDIX TOP EARNERS — FRONTEND CONFIGURATION

  Keep entries empty until your backend provides verified leaderboard data.

  Expected record:
  {
    id: "unique-id",
    displayName: "Public display name",
    avatarUrl: "",                // Optional approved HTTPS image
    eligibleEarnings: 0,           // Verified eligible rewards, NGN
    activitiesCompleted: 0,        // Optional verified count
    achievement: "",               // Optional configured achievement
    verified: true,
    createdAt: "2026-10-01T10:00:00Z",
    periods: ["all", "month", "week"] // Optional explicit period membership
  }

  This file does not connect to a backend or create sample members.
*/

const KUDIX_LEADERBOARD_CONFIG = {
    currency: "NGN",
    locale: "en-NG",
    records: [],
    lastUpdated: null
};

document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;

    const sidebar = document.getElementById("sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const menuToggle = document.getElementById("menuToggle");
    const themeToggle = document.getElementById("themeToggle");

    const podiumGrid = document.getElementById("podiumGrid");
    const leaderboardBody = document.getElementById("leaderboardBody");
    const leaderboardEmpty = document.getElementById("leaderboardEmpty");
    const emptyTitle = document.getElementById("emptyTitle");
    const emptyDescription = document.getElementById("emptyDescription");

    const searchInput = document.getElementById("leaderSearch");
    const clearSearch = document.getElementById("clearSearch");
    const sortSelect = document.getElementById("sortLeaderboard");
    const rankingCount = document.getElementById("rankingCount");
    const lastUpdated = document.getElementById("lastUpdated");
    const resetButton = document.getElementById("resetLeaderboard");
    const toastMessage = document.getElementById("toastMessage");

    const statRankedMembers = document.getElementById("rankedMembers");
    const statTotalEarnings = document.getElementById("totalEarnings");
    const statCompletedActivities = document.getElementById("completedActivities");
    const statCurrentLeader = document.getElementById("currentLeader");

    let selectedPeriod = "all";
    let toastTimeout = null;

    function showToast(message) {
        toastMessage.textContent = message;
        toastMessage.classList.add("show");

        window.clearTimeout(toastTimeout);
        toastTimeout = window.setTimeout(() => {
            toastMessage.classList.remove("show");
        }, 2600);
    }

    // -------------------------
    // Theme
    // -------------------------

    function applyTheme(theme) {
        const isDark = theme === "dark";
        body.classList.toggle("dark-theme", isDark);

        const icon = themeToggle.querySelector("i");
        icon.className = isDark ? "bx bx-sun" : "bx bx-moon";

        themeToggle.setAttribute(
            "aria-label",
            isDark ? "Switch to light theme" : "Switch to dark theme"
        );

        themeToggle.title = isDark ? "Switch to light theme" : "Switch to dark theme";
    }

    function loadTheme() {
        try {
            const savedTheme = localStorage.getItem("kudix-theme");
            applyTheme(savedTheme === "dark" ? "dark" : "light");
        } catch {
            applyTheme("light");
        }
    }

    themeToggle.addEventListener("click", () => {
        const nextTheme = body.classList.contains("dark-theme") ? "light" : "dark";
        applyTheme(nextTheme);

        try {
            localStorage.setItem("kudix-theme", nextTheme);
        } catch {
            // Theme still works for the current page if storage is unavailable.
        }
    });

    loadTheme();

    // -------------------------
    // Responsive navigation
    // -------------------------

    function openSidebar() {
        body.classList.add("sidebar-open");
        menuToggle.setAttribute("aria-expanded", "true");
        menuToggle.setAttribute("aria-label", "Close navigation");
        sidebar.setAttribute("aria-modal", "true");
    }

    function closeSidebar() {
        body.classList.remove("sidebar-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
        sidebar.removeAttribute("aria-modal");
    }

    menuToggle.addEventListener("click", () => {
        if (body.classList.contains("sidebar-open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    sidebarOverlay.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && body.classList.contains("sidebar-open")) {
            closeSidebar();
            menuToggle.focus();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 950) closeSidebar();
    });

    // -------------------------
    // Safe formatting and DOM
    // -------------------------

    const moneyFormatter = new Intl.NumberFormat(
        KUDIX_LEADERBOARD_CONFIG.locale,
        {
            style: "currency",
            currency: KUDIX_LEADERBOARD_CONFIG.currency,
            maximumFractionDigits: 2
        }
    );

    const numberFormatter = new Intl.NumberFormat(KUDIX_LEADERBOARD_CONFIG.locale);

    function formatMoney(value) {
        return moneyFormatter.format(value);
    }

    function formatNumber(value) {
        return numberFormatter.format(value);
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        return element;
    }

    function isValidImageUrl(value) {
        if (typeof value !== "string" || !value.trim()) return false;

        try {
            const url = new URL(value, window.location.href);
            return url.protocol === "https:";
        } catch {
            return false;
        }
    }

    function getInitials(name) {
        return String(name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => Array.from(part)[0] || "")
            .join("")
            .toUpperCase() || "?";
    }

    function createAvatar(name, imageUrl, className) {
        const avatar = createElement("div", className);

        if (isValidImageUrl(imageUrl)) {
            const image = document.createElement("img");
            image.src = imageUrl;
            image.alt = "";
            image.loading = "lazy";
            image.referrerPolicy = "no-referrer";

            image.addEventListener("error", () => {
                avatar.replaceChildren();
                avatar.textContent = getInitials(name);
            }, { once: true });

            avatar.appendChild(image);
        } else {
            avatar.textContent = getInitials(name);
        }

        return avatar;
    }

    function normalizeRecords(records) {
        if (!Array.isArray(records)) return [];

        const seenIds = new Set();

        return records.filter((record) => {
            if (!record || typeof record !== "object") return false;
            if (record.verified !== true) return false;
            if (typeof record.id !== "string" || !record.id.trim()) return false;
            if (seenIds.has(record.id)) return false;

            const displayName =
                typeof record.displayName === "string"
                    ? record.displayName.trim()
                    : "";

            const earnings = record.eligibleEarnings;

            if (!displayName) return false;
            if (typeof earnings !== "number" || !Number.isFinite(earnings) || earnings < 0) {
                return false;
            }

            if (
                record.activitiesCompleted !== undefined &&
                record.activitiesCompleted !== null &&
                (!Number.isSafeInteger(record.activitiesCompleted) ||
                    record.activitiesCompleted < 0)
            ) {
                return false;
            }

            seenIds.add(record.id);

            return true;
        }).map((record) => ({
            ...record,
            displayName: record.displayName.trim()
        }));
    }

    const verifiedRecords = normalizeRecords(KUDIX_LEADERBOARD_CONFIG.records);

    function compareEarnings(a, b) {
        return b.eligibleEarnings - a.eligibleEarnings ||
            a.displayName.localeCompare(b.displayName);
    }

    function getRankedRecords(records) {
        return [...records].sort(compareEarnings).map((record, index) => ({
            ...record,
            rank: index + 1
        }));
    }

    function getPeriodRecords(records) {
        if (selectedPeriod === "all") return records;

        // Periods must be supplied explicitly by the backend or data source.
        // Do not estimate a member's period earnings from their all-time total.
        return records.filter((record) =>
            Array.isArray(record.periods) &&
            record.periods.includes(selectedPeriod)
        );
    }

    function getVisibleRecords() {
        const periodRecords = getRankedRecords(getPeriodRecords(verifiedRecords));
        const query = searchInput.value.trim().toLocaleLowerCase();

        let records = periodRecords.filter((record) =>
            record.displayName.toLocaleLowerCase().includes(query)
        );

        switch (sortSelect.value) {
            case "earnings":
                records.sort(compareEarnings);
                break;

            case "activities":
                records.sort((a, b) => {
                    const aCount = Number.isSafeInteger(a.activitiesCompleted)
                        ? a.activitiesCompleted : -1;
                    const bCount = Number.isSafeInteger(b.activitiesCompleted)
                        ? b.activitiesCompleted : -1;

                    return bCount - aCount || compareEarnings(a, b);
                });
                break;

            case "name":
                records.sort((a, b) => a.displayName.localeCompare(b.displayName));
                break;

            default:
                records.sort((a, b) => a.rank - b.rank);
        }

        return records;
    }

    // -------------------------
    // Statistics
    // -------------------------

    function renderStats(records) {
        const ranked = getRankedRecords(records);

        statRankedMembers.textContent = formatNumber(ranked.length);

        const total = ranked.reduce(
            (sum, record) => sum + record.eligibleEarnings,
            0
        );

        statTotalEarnings.textContent = formatMoney(total);

        const hasAllActivityCounts = ranked.every((record) =>
            Number.isSafeInteger(record.activitiesCompleted)
        );

        statCompletedActivities.textContent = hasAllActivityCounts
            ? formatNumber(
                ranked.reduce((sum, record) => sum + record.activitiesCompleted, 0)
            )
            : "—";

        statCurrentLeader.textContent = ranked[0]
            ? ranked[0].displayName
            : "—";
    }

    // -------------------------
    // Podium
    // -------------------------

    function createPodiumCard(record, place) {
        const placeClasses = ["first", "second", "third"];
        const placeCaptions = {
            1: "1st Place",
            2: "2nd Place",
            3: "3rd Place"
        };

        const card = createElement(
            "article",
            `podium-card ${placeClasses[place - 1]}`
        );

        const rank = createElement("span", "podium-rank", `#${place}`);
        card.appendChild(rank);

        if (place === 1) {
            const crown = createElement("i", "bx bxs-crown podium-crown");
            crown.setAttribute("aria-hidden", "true");
            card.appendChild(crown);
        }

        card.appendChild(
            createAvatar(record.displayName, record.avatarUrl, "podium-avatar")
        );

        card.appendChild(createElement("h3", "podium-name", record.displayName));
        card.appendChild(
            createElement("div", "podium-earnings", formatMoney(record.eligibleEarnings))
        );
        card.appendChild(createElement("span", "podium-caption", placeCaptions[place]));

        return card;
    }

    function renderPodium(records) {
        podiumGrid.replaceChildren();

        if (!records.length) {
            podiumGrid.hidden = true;
            return;
        }

        podiumGrid.hidden = false;

        // Standard visual podium order: second, first, third.
        const podiumOrder = [
            { record: records[1], place: 2 },
            { record: records[0], place: 1 },
            { record: records[2], place: 3 }
        ];

        podiumOrder.forEach(({ record, place }) => {
            if (record) podiumGrid.appendChild(createPodiumCard(record, place));
        });
    }

    // -------------------------
    // Leaderboard table
    // -------------------------

    function createTableRow(record) {
        const row = document.createElement("tr");

        const rankCell = document.createElement("td");
        const rank = createElement("span", "rank-medal", `#${record.rank}`);

        if (record.rank <= 3) rank.classList.add(`rank-${record.rank}`);

        rankCell.appendChild(rank);
        row.appendChild(rankCell);

        const memberCell = document.createElement("td");
        const member = createElement("div", "member-cell");

        member.appendChild(
            createAvatar(record.displayName, record.avatarUrl, "member-avatar")
        );

        const memberCopy = document.createElement("div");
        memberCopy.appendChild(
            createElement("div", "member-name", record.displayName)
        );
        memberCopy.appendChild(
            createElement("span", "member-subtitle", "Verified member")
        );

        member.appendChild(memberCopy);
        memberCell.appendChild(member);
        row.appendChild(memberCell);

        const earningsCell = createElement(
            "td",
            "earnings-cell",
            formatMoney(record.eligibleEarnings)
        );
        row.appendChild(earningsCell);

        const activityCell = createElement(
            "td",
            "activity-cell",
            Number.isSafeInteger(record.activitiesCompleted)
                ? formatNumber(record.activitiesCompleted)
                : "—"
        );
        row.appendChild(activityCell);

        const achievementCell = document.createElement("td");

        if (typeof record.achievement === "string" && record.achievement.trim()) {
            const achievement = createElement("span", "achievement-tag");
            const icon = createElement("i", "bx bx-award");
            icon.setAttribute("aria-hidden", "true");

            achievement.appendChild(icon);
            achievement.appendChild(document.createTextNode(record.achievement.trim()));
            achievementCell.appendChild(achievement);
        } else {
            achievementCell.textContent = "—";
        }

        row.appendChild(achievementCell);

        return row;
    }

    function renderTable(records) {
        leaderboardBody.replaceChildren();

        const hasSearch = searchInput.value.trim().length > 0;

        if (!records.length) {
            leaderboardEmpty.hidden = false;
            podiumGrid.hidden = true;

            if (hasSearch && verifiedRecords.length) {
                emptyTitle.textContent = "No matching members found.";
                emptyDescription.textContent =
                    "Try another display name or reset your search and filters.";
            } else if (selectedPeriod !== "all" && verifiedRecords.length) {
                emptyTitle.textContent = "No verified rankings for this period.";
                emptyDescription.textContent =
                    "Period-specific rankings will appear when verified data for this time range is available.";
            } else {
                emptyTitle.textContent = "The leaderboard is getting ready.";
                emptyDescription.textContent =
                    "Verified community rankings will appear here when leaderboard data becomes available.";
            }

            rankingCount.textContent = "No matching leaderboard entries";
            return;
        }

        leaderboardEmpty.hidden = true;

        records.forEach((record) => {
            leaderboardBody.appendChild(createTableRow(record));
        });

        rankingCount.textContent =
            `${formatNumber(records.length)} member${records.length === 1 ? "" : "s"} shown`;

        const fullPeriodRecords = getPeriodRecords(verifiedRecords);
        renderPodium(getRankedRecords(fullPeriodRecords).slice(0, 3));
    }

    // -------------------------
    // Period buttons and search
    // -------------------------

    function renderPage() {
        const periodRecords = getRankedRecords(getPeriodRecords(verifiedRecords));
        renderStats(periodRecords);
        renderTable(getVisibleRecords());
    }

    document.querySelectorAll(".period-button").forEach((button) => {
        button.addEventListener("click", () => {
            selectedPeriod = button.dataset.period || "all";

            document.querySelectorAll(".period-button").forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            renderPage();
        });
    });

    searchInput.addEventListener("input", () => {
        clearSearch.hidden = searchInput.value.length === 0;
        renderPage();
    });

    clearSearch.addEventListener("click", () => {
        searchInput.value = "";
        clearSearch.hidden = true;
        searchInput.focus();
        renderPage();
    });

    sortSelect.addEventListener("change", renderPage);

    resetButton.addEventListener("click", () => {
        selectedPeriod = "all";
        searchInput.value = "";
        clearSearch.hidden = true;
        sortSelect.value = "rank";

        document.querySelectorAll(".period-button").forEach((button) => {
            const isActive = button.dataset.period === "all";
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        renderPage();
    });

    // -------------------------
    // Footer and last update
    // -------------------------

    document.getElementById("currentYear").textContent =
        String(new Date().getFullYear());

    if (KUDIX_LEADERBOARD_CONFIG.lastUpdated) {
        const timestamp = new Date(KUDIX_LEADERBOARD_CONFIG.lastUpdated);

        if (!Number.isNaN(timestamp.getTime())) {
            lastUpdated.textContent =
                `Last updated ${timestamp.toLocaleString(KUDIX_LEADERBOARD_CONFIG.locale)}`;
        } else {
            lastUpdated.textContent = "Update time unavailable";
        }
    } else {
        lastUpdated.textContent = "Leaderboard update time unavailable";
    }

    // Initial render. Empty data produces a clear, honest empty state.
    renderPage();
});
