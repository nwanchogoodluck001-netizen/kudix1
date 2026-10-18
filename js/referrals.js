
"use strict";

/*
 * KUDIX REFERRALS
 * Frontend-only implementation.
 *
 * IMPORTANT:
 * - No fake users or referral records are created.
 * - No rewards are automatically credited.
 * - Replace the empty data values with verified backend data later.
 */

const KUDIX_REFERRALS_CONFIG = {
    // Populate these fields from your authenticated backend later.
    referralLink: "",
    referralCode: "",

    stats: {
        total: null,
        successful: null,
        pending: null,
        rewards: null
    },

    // Example expected record structure:
    // {
    //   id: "backend-record-id",
    //   name: "Name supplied by backend",
    //   dateJoined: "2026-10-17",
    //   status: "Pending",
    //   reward: null
    // }
    referrals: [],

    // Leave empty until official program milestones are configured.
    milestones: []
};


/* ----------------------------------
   DOM HELPERS
---------------------------------- */

const $ = (selector, root = document) =>
    root.querySelector(selector);

const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));


/* ----------------------------------
   THEME MANAGEMENT
---------------------------------- */

function getSavedTheme() {
    try {
        return localStorage.getItem("kudix-theme") || "light";
    } catch (error) {
        return "light";
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem("kudix-theme", theme);
    } catch (error) {
        // The page remains usable when storage is unavailable.
    }
}

function applyTheme(theme) {
    const isDark = theme === "dark";

    document.documentElement.classList.toggle("dark", isDark);

    const icon = $("#themeIcon");
    const button = $("#themeToggle");

    if (icon) {
        icon.className = isDark ? "bx bx-sun" : "bx bx-moon";
    }

    if (button) {
        button.setAttribute(
            "aria-label",
            isDark ? "Switch to light theme" : "Switch to dark theme"
        );

        button.setAttribute(
            "title",
            isDark ? "Switch to light theme" : "Switch to dark theme"
        );
    }
}

function initializeTheme() {
    applyTheme(getSavedTheme());

    $("#themeToggle")?.addEventListener("click", () => {
        const nextTheme = document.documentElement.classList.contains("dark")
            ? "light"
            : "dark";

        applyTheme(nextTheme);
        saveTheme(nextTheme);
    });
}


/* ----------------------------------
   MOBILE SIDEBAR
---------------------------------- */

function initializeSidebar() {
    const sidebar = $("#sidebar");
    const overlay = $("#sidebarOverlay");
    const openButton = $("#openSidebar");
    const closeButton = $("#closeSidebar");

    if (!sidebar || !overlay) return;

    function openSidebar() {
        sidebar.classList.add("sidebar-open");
        overlay.classList.add("overlay-visible");

        openButton?.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";

        closeButton?.focus();
    }

    function closeSidebar() {
        sidebar.classList.remove("sidebar-open");
        overlay.classList.remove("overlay-visible");

        openButton?.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";

        openButton?.focus();
    }

    openButton?.setAttribute("aria-expanded", "false");
    openButton?.addEventListener("click", openSidebar);
    closeButton?.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 900) {
                closeSidebar();
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            sidebar.classList.contains("sidebar-open")
        ) {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            sidebar.classList.remove("sidebar-open");
            overlay.classList.remove("overlay-visible");
            document.body.style.overflow = "";
            openButton?.setAttribute("aria-expanded", "false");
        }
    });
}


/* ----------------------------------
   TOAST NOTIFICATIONS
---------------------------------- */

function showToast(title, message, type = "success") {
    const container = $("#toastContainer");

    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "error" : ""}`;
    toast.setAttribute("role", "status");

    const icon = document.createElement("div");
    icon.className = "toast-icon";

    const iconElement = document.createElement("i");
    iconElement.className =
        type === "error" ? "bx bx-error-circle" : "bx bx-check-circle";

    icon.appendChild(iconElement);

    const content = document.createElement("div");

    const heading = document.createElement("strong");
    heading.textContent = title;

    const description = document.createElement("p");
    description.textContent = message;

    content.append(heading, description);
    toast.append(icon, content);
    container.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 4000);
}


/* ----------------------------------
   REFERRAL LINK
---------------------------------- */

function getValidReferralLink() {
    const value = String(
        KUDIX_REFERRALS_CONFIG.referralLink || ""
    ).trim();

    if (!value) return "";

    try {
        const parsed = new URL(value);

        // Only allow secure links.
        if (parsed.protocol !== "https:") {
            return "";
        }

        return parsed.href;
    } catch (error) {
        return "";
    }
}

function getValidReferralCode() {
    return String(
        KUDIX_REFERRALS_CONFIG.referralCode || ""
    ).trim();
}

function updateReferralLinkUI() {
    const input = $("#referralLink");
    const copyButton = $("#copyLinkBtn");
    const shareButton = $("#shareLinkBtn");
    const help = $("#linkHelp");
    const code = $("#referralCode");
    const status = $(".code-status");

    const link = getValidReferralLink();
    const referralCode = getValidReferralCode();

    if (input) {
        input.value = link;
        input.placeholder = link
            ? ""
            : "Your referral link will appear here when available";
    }

    if (copyButton) copyButton.disabled = !link;
    if (shareButton) shareButton.disabled = !link;

    if (help) {
        help.textContent = link
            ? "Your referral link is ready to share. Eligibility requirements apply."
            : "Your personal link will be displayed once your account referral details are connected.";
    }

    if (code) {
        code.textContent = referralCode || "Not available yet";
    }

    if (status) {
        if (link || referralCode) {
            status.innerHTML =
                '<span class="status-dot"></span> Referral details available';
        } else {
            status.innerHTML =
                '<span class="status-dot"></span> Awaiting account connection';
        }
    }
}

async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    // Fallback for browsers without Clipboard API support.
    const temporaryInput = document.createElement("textarea");

    temporaryInput.value = text;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.left = "-9999px";
    temporaryInput.style.top = "0";

    document.body.appendChild(temporaryInput);
    temporaryInput.select();

    const copied = document.execCommand("copy");
    temporaryInput.remove();

    if (!copied) {
        throw new Error("Copy operation was not successful.");
    }
}

async function handleCopyLink() {
    const link = getValidReferralLink();

    if (!link) {
        showToast(
            "Referral link unavailable",
            "Your account referral link has not been connected yet.",
            "error"
        );
        return;
    }

    try {
        await copyText(link);

        showToast(
            "Link copied",
            "Your referral link is ready to share."
        );
    } catch (error) {
        showToast(
            "Unable to copy",
            "Please select and copy your referral link manually.",
            "error"
        );
    }
}

async function handleShareLink() {
    const link = getValidReferralLink();

    if (!link) {
        showToast(
            "Referral link unavailable",
            "Your account referral link has not been connected yet.",
            "error"
        );
        return;
    }

    const shareData = {
        title: "Join KUDIX",
        text: "Check out KUDIX and learn about its games and activities. Eligibility and platform rules apply.",
        url: link
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (error) {
            // A cancelled share is normal and should not produce an error toast.
            if (error.name !== "AbortError") {
                showToast(
                    "Sharing unavailable",
                    "Try copying the referral link instead.",
                    "error"
                );
            }
        }

        return;
    }

    // Desktop/browser fallback.
    await handleCopyLink();
}

function initializeReferralActions() {
    $("#copyLinkBtn")?.addEventListener("click", handleCopyLink);
    $("#shareLinkBtn")?.addEventListener("click", handleShareLink);

    updateReferralLinkUI();
}


/* ----------------------------------
   STATISTICS
---------------------------------- */

function formatCount(value) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0
    ) {
        return "—";
    }

    return new Intl.NumberFormat("en-NG", {
        maximumFractionDigits: 0
    }).format(value);
}

function formatNaira(value) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0
    ) {
        return "—";
    }

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(value);
}

function renderStatistics() {
    const stats = KUDIX_REFERRALS_CONFIG.stats || {};

    const values = {
        total: formatCount(stats.total),
        successful: formatCount(stats.successful),
        pending: formatCount(stats.pending),
        rewards: formatNaira(stats.rewards)
    };

    Object.entries(values).forEach(([key, value]) => {
        const element = $(`[data-stat="${key}"]`);

        if (element) {
            element.textContent = value;
        }
    });
}


/* ----------------------------------
   REFERRAL PROGRESS
---------------------------------- */

function renderProgress() {
    const container = $("#progressCard");

    if (!container) return;

    const milestones = KUDIX_REFERRALS_CONFIG.milestones;
    const total = KUDIX_REFERRALS_CONFIG.stats?.total;

    if (!Array.isArray(milestones) || milestones.length === 0) {
        container.replaceChildren();

        const icon = document.createElement("div");
        icon.className = "progress-empty-icon";

        const iconElement = document.createElement("i");
        iconElement.className = "bx bx-bar-chart-alt-2";
        icon.appendChild(iconElement);

        const title = document.createElement("h4");
        title.textContent = "Your progress will appear here";

        const message = document.createElement("p");
        message.textContent =
            "Referral counts and milestones will be shown when your account data and official program milestones are connected.";

        container.append(icon, title, message);
        return;
    }

    container.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = "Your configured milestones";

    const description = document.createElement("p");
    description.textContent =
        typeof total === "number"
            ? `Current referral count: ${formatCount(total)}. Progress is based on the configured program requirements.`
            : "Connect verified referral counts to calculate milestone progress.";

    container.append(heading, description);

    milestones.forEach((milestone) => {
        if (
            !milestone ||
            typeof milestone.target !== "number" ||
            milestone.target <= 0
        ) {
            return;
        }

        const row = document.createElement("div");
        row.className = "milestone-row";

        const label = document.createElement("strong");
        label.textContent = String(milestone.label || "Referral milestone");

        const count = document.createElement("span");
        count.textContent =
            typeof total === "number"
                ? `${formatCount(Math.min(total, milestone.target))} / ${formatCount(milestone.target)}`
                : `— / ${formatCount(milestone.target)}`;

        const track = document.createElement("div");
        track.className = "milestone-track";

        const fill = document.createElement("div");
        fill.className = "milestone-fill";

        const progress = typeof total === "number"
            ? Math.min(100, (total / milestone.target) * 100)
            : 0;

        fill.style.width = `${progress}%`;

        track.appendChild(fill);
        row.append(label, count, track);
        container.appendChild(row);
    });
}


/* ----------------------------------
   REFERRAL HISTORY
---------------------------------- */

const REFERRAL_STATUS_CLASSES = {
    "pending": "status-pending",
    "qualified": "status-qualified",
    "reward credited": "status-credited",
    "not eligible": "status-ineligible"
};

function formatDate(value) {
    if (!value) return "—";

    // Avoid invalid or ambiguous date formatting.
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}

function renderEmptyHistory() {
    const body = $("#referralsTableBody");
    if (!body) return;

    body.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;

    const empty = document.createElement("div");
    empty.className = "table-empty";

    const illustration = document.createElement("div");
    illustration.className = "empty-illustration";

    const icon = document.createElement("i");
    icon.className = "bx bx-user-plus";
    illustration.appendChild(icon);

    const heading = document.createElement("h4");
    heading.textContent = "Your referral journey starts here.";

    const message = document.createElement("p");
    message.textContent =
        "Share your referral link with friends. Eligible referrals will appear here once your account is connected.";

    empty.append(illustration, heading, message);
    cell.appendChild(empty);
    row.appendChild(cell);
    body.appendChild(row);

    const count = $("#historyCount");
    if (count) count.textContent = "0 records";
}

function renderReferralRecord(referral) {
    const row = document.createElement("tr");

    // User identity
    const userCell = document.createElement("td");
    const user = document.createElement("div");
    user.className = "referral-user";

    const avatar = document.createElement("span");
    avatar.className = "user-initial";

    const name = String(referral.name || "Unnamed user").trim();
    avatar.textContent = name.charAt(0).toUpperCase() || "?";

    const userName = document.createElement("span");
    userName.className = "user-name";
    userName.textContent = name;

    user.append(avatar, userName);
    userCell.appendChild(user);

    // Date
    const dateCell = createCell(formatDate(referral.dateJoined));

    // Status
    const statusCell = document.createElement("td");
    const status = String(referral.status || "Pending").trim();
    const pill = document.createElement("span");

    pill.className =
        "status-pill " +
        (REFERRAL_STATUS_CLASSES[status.toLowerCase()] || "status-neutral");

    pill.textContent = status;
    statusCell.appendChild(pill);

    // Reward: only show the value received from actual account data.
    const rewardCell = document.createElement("td");
    const reward = document.createElement("span");
    reward.className = "reward-amount";

    if (typeof referral.reward === "number" && referral.reward >= 0) {
        reward.textContent = formatNaira(referral.reward);
    } else {
        reward.textContent = "—";
    }

    rewardCell.appendChild(reward);

    // Action: no fabricated detail page or transaction.
    const actionCell = document.createElement("td");
    const action = document.createElement("button");

    action.type = "button";
    action.className = "table-action";
    action.innerHTML = 'View status <i class="bx bx-right-arrow-alt"></i>';

    action.addEventListener("click", () => {
        showToast(
            "Referral status",
            `${name}: ${status}. For further details, contact KUDIX support.`
        );
    });

    actionCell.appendChild(action);

    row.append(userCell, dateCell, statusCell, rewardCell, actionCell);

    return row;
}

function renderReferralHistory() {
    const body = $("#referralsTableBody");
    if (!body) return;

    const referrals = KUDIX_REFERRALS_CONFIG.referrals;

    if (!Array.isArray(referrals) || referrals.length === 0) {
        renderEmptyHistory();
        return;
    }

    body.replaceChildren();

    referrals.forEach((referral) => {
        if (!referral || typeof referral !== "object") return;

        body.appendChild(renderReferralRecord(referral));
    });

    const count = $("#historyCount");
    const total = body.querySelectorAll("tr").length;

    if (count) {
        count.textContent = `${total} ${total === 1 ? "record" : "records"}`;
    }

    if (total === 0) {
        renderEmptyHistory();
    }
}


/* ----------------------------------
   FOOTER
---------------------------------- */

function initializeFooter() {
    const year = $("#footerYear");

    if (year) {
        year.textContent = new Date().getFullYear();
    }
}


/* ----------------------------------
   INITIALIZATION
---------------------------------- */

function initializeReferralsPage() {
    initializeTheme();
    initializeSidebar();
    initializeReferralActions();
    renderStatistics();
    renderProgress();
    renderReferralHistory();
    initializeFooter();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeReferralsPage,
        { once: true }
    );
} else {
    initializeReferralsPage();
}
