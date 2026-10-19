

/*
  KUDIX DAILY STREAK CONFIGURATION
 
  The UI assumes the user has passed the two-referral requirement.
  Real eligibility, streak values, rewards and claims must come from
  the existing authenticated backend.
 
  Admin-configured naira reward amounts should be returned by the backend.
  No hard-coded sample amounts are used as earned rewards.
 
  Configure the real documented endpoints and map the real response schema
  before enabling check-ins. Do not add secret keys to frontend code.
*/

const STREAK_API = {
    baseUrl: "",
    accountEndpoint: "",
    claimEndpoint: "",
    credentials: "same-origin"
};

const state = {
    ready: false,
    claiming: false,
    account: null
};

const $ = (selector) => document.querySelector(selector);

function formatNaira(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        return "—";
    }

    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2
    }).format(amount);
}

function showNotice(message, type = "warning") {
    const box = $("#pageNotice");
    box.className = "notice" +
        (type === "success" ? " success" : type === "error" ? " error" : "");

    const row = document.createElement("div");
    row.className = "flex gap-3 items-start";

    const icon = document.createElement("i");
    icon.className = "bx text-lg mt-0.5 " +
        (type === "success" ? "bx-check-circle" :
            type === "error" ? "bx-error-circle" : "bx-info-circle");

    const text = document.createElement("p");
    text.textContent = message;

    row.append(icon, text);
    box.replaceChildren(row);
}

function setCheckinButton(label, icon, disabled = true) {
    const button = $("#checkinButton");
    button.disabled = disabled;

    const iconElement = document.createElement("i");
    iconElement.className = `bx ${icon} text-xl`;

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    button.replaceChildren(iconElement, labelElement);
}

function renderUnavailable() {
    state.ready = false;
    state.account = null;

    $("#currentStreak").textContent = "—";
    $("#bestStreak").textContent = "—";
    $("#todayReward").textContent = "—";
    $("#totalRewards").textContent = "—";
    $("#weeklyProgressText").textContent = "Awaiting account data";
    $("#weeklyProgressFill").style.width = "0%";
    $("#checkinStatus").textContent =
        "Connect the backend to verify today's eligibility and claim status.";

    setCheckinButton("Check In Today", "bx-lock-alt", true);
    renderCalendar(null);
}

/*
  Map the actual API response to this UI model only after the backend
  schema is provided. The field names below describe the UI adapter,
  not presumed backend fields.
 
  {
    currentStreak: number,
    bestStreak: number,
    totalRewards: number,
    qualifyingReferrals: number,
    eligible: boolean,
    checkedInToday: boolean,
    claimAvailable: boolean,
    days: [{
      day: 1..7,
      status: "complete" | "current" | "upcoming",
      rewardAmount: number
    }]
  }
*/
function normalizeAccountResponse(_response) {
    throw new Error(
        "The KUDIX account response schema has not been configured."
    );
}

function renderCalendar(account) {
    const calendar = $("#streakCalendar");
    calendar.replaceChildren();

    for (let day = 1; day <= 7; day++) {
        const dayData = account?.days?.find((item) => item.day === day);
        const status = dayData?.status || "upcoming";

        const tile = document.createElement("div");
        tile.className = "day-tile";

        if (status === "complete") tile.classList.add("complete");
        if (status === "current") tile.classList.add("current");

        const dayName = document.createElement("span");
        dayName.className = "text-[10px] text-slate-500";
        dayName.textContent = `DAY ${day}`;

        const iconBox = document.createElement("span");
        iconBox.className = "day-icon";

        const icon = document.createElement("i");
        icon.className = status === "complete"
            ? "bx bx-check-circle"
            : day === 7
                ? "bx bx-trophy"
                : status === "current"
                    ? "bx bxs-hot"
                    : "bx bx-calendar-check";

        iconBox.appendChild(icon);

        const label = document.createElement("span");
        label.className = "text-[10px] font-semibold";
        label.textContent = status === "complete"
            ? "Completed"
            : status === "current"
                ? "Today"
                : day === 7
                    ? "Weekly reward"
                    : "Upcoming";

        const reward = document.createElement("span");
        reward.className = "text-[9px] text-slate-500";
        reward.textContent = dayData && typeof dayData.rewardAmount === "number"
            ? formatNaira(dayData.rewardAmount)
            : "Reward unavailable";

        tile.append(dayName, iconBox, label, reward);
        calendar.appendChild(tile);
    }
}

function renderAccount(account) {
    if (!account || typeof account !== "object") {
        throw new Error("Invalid account response.");
    }

    const numericFields = [
        "currentStreak",
        "bestStreak",
        "totalRewards",
        "qualifyingReferrals"
    ];

    for (const field of numericFields) {
        if (!Number.isFinite(account[field]) || account[field] < 0) {
            throw new Error(`Missing or invalid account field: ${field}`);
        }
    }

    const eligible =
        account.qualifyingReferrals >= 2 &&
        account.eligible === true;

    $("#currentStreak").textContent = String(account.currentStreak);
    $("#bestStreak").textContent = String(account.bestStreak);
    $("#totalRewards").textContent = formatNaira(account.totalRewards);

    const today = Array.isArray(account.days)
        ? account.days.find((day) => day.status === "current")
        : null;

    $("#todayReward").textContent =
        today && typeof today.rewardAmount === "number"
            ? formatNaira(today.rewardAmount)
            : "—";

    const completedDays = Array.isArray(account.days)
        ? account.days.filter((day) => day.status === "complete").length
        : 0;

    const progress = Math.min(100, (completedDays / 7) * 100);
    $("#weeklyProgressFill").style.width = `${progress}%`;
    $("#weeklyProgressText").textContent = `${completedDays} of 7 days completed`;

    renderCalendar(account);

    const canClaim = eligible &&
        account.checkedInToday === false &&
        account.claimAvailable === true;

    if (account.checkedInToday === true) {
        setCheckinButton("Already Checked In", "bx-check-circle", true);
        $("#checkinStatus").textContent = "Today's check-in is already complete.";
    } else if (canClaim) {
        setCheckinButton("Check In Today", "bx-flame", false);
        $("#checkinStatus").textContent = "You're eligible to claim today's reward.";
    } else {
        setCheckinButton("Check In Today", "bx-lock-alt", true);
        $("#checkinStatus").textContent =
            "No eligible check-in is currently available.";
    }

    state.ready = true;
    state.account = account;
}

async function apiRequest(endpoint, options = {}) {
    if (!STREAK_API.baseUrl || !endpoint) {
        throw new Error("The required backend endpoint is not configured.");
    }

    const base = STREAK_API.baseUrl.replace(/\/+$/, "");
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    const response = await fetch(base + path, {
        ...options,
        credentials: STREAK_API.credentials,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`Request failed (HTTP ${response.status}).`);
    }

    return response.json();
}

async function loadAccount() {
    if (!STREAK_API.baseUrl || !STREAK_API.accountEndpoint) {
        renderUnavailable();
        showNotice(
            "The unlocked Daily Streak design is ready, but live rewards and check-ins need the documented KUDIX backend. No claim has been made."
        );
        return;
    }

    try {
        const response = await apiRequest(STREAK_API.accountEndpoint);
        const account = normalizeAccountResponse(response);
        renderAccount(account);
        showNotice("Your streak information was refreshed from the server.", "success");
    } catch (error) {
        renderUnavailable();
        showNotice(error.message || "Unable to load your streak information.", "error");
    }
}

async function claimDailyReward() {
    const account = state.account;

    if (
        state.claiming ||
        !state.ready ||
        !account ||
        account.qualifyingReferrals < 2 ||
        account.eligible !== true ||
        account.checkedInToday !== false ||
        account.claimAvailable !== true
    ) {
        return;
    }

    if (!STREAK_API.claimEndpoint) {
        showNotice("The documented daily-claim endpoint has not been configured.", "error");
        return;
    }

    state.claiming = true;
    setCheckinButton("Processing...", "bx-loader-alt bx-spin", true);

    try {
        // The server must validate eligibility and process the claim atomically.
        await apiRequest(STREAK_API.claimEndpoint, {
            method: "POST",
            body: JSON.stringify({})
        });

        showNotice(
            "The server accepted your check-in request. Refreshing your account details.",
            "success"
        );

        await loadAccount();
    } catch (error) {
        showNotice(error.message || "The check-in could not be completed.", "error");
    } finally {
        state.claiming = false;

        if (state.account) {
            const canClaim =
                state.account.qualifyingReferrals >= 2 &&
                state.account.eligible === true &&
                state.account.checkedInToday === false &&
                state.account.claimAvailable === true;

            setCheckinButton(
                state.account.checkedInToday ? "Already Checked In" : "Check In Today",
                state.account.checkedInToday ? "bx-check-circle" : "bx-flame",
                !canClaim
            );
        }
    }
}

$("#checkinButton").addEventListener("click", claimDailyReward);

// Mobile sidebar.
const sidebar = $("#sidebar");
const menuButton = $("#menuButton");
const overlay = $("#sidebarOverlay");

function toggleSidebar(open) {
    sidebar.classList.toggle("open", open);
    overlay.classList.toggle("show", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    document.body.style.overflow = open ? "hidden" : "";
}

menuButton.addEventListener("click", () => {
    toggleSidebar(!sidebar.classList.contains("open"));
});

overlay.addEventListener("click", () => toggleSidebar(false));

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleSidebar(false);
});

sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => toggleSidebar(false));
});

// Safe default: unlocked layout, but no invented live data or claims.
renderUnavailable();
