"use strict";

/*
 * KUDIX Manage Games
 *
 * Frontend interface with explicit backend integration points.
 * No configurations or results are falsely reported as saved.
 */

const GAME_API = {
    baseUrl: "",
    gamesEndpoint: "/api/admin/games",
    dailySettingsEndpoint: "/api/admin/game-settings/daily",
    resultsEndpoint: "/api/admin/game-results",
    signalsEndpoint: "/api/admin/game-signals"
};

const GAME_DEFINITIONS = [
    {
        id: "number-prediction",
        name: "Number Prediction",
        icon: "bx-hash",
        type: "number",
        description: "A game based on number selections and published rules."
    },
    {
        id: "colour-prediction",
        name: "Colour Prediction",
        icon: "bx-palette",
        type: "colour",
        description: "A colour-based challenge with clearly explained rules."
    },
    {
        id: "lucky-number",
        name: "Lucky Number",
        icon: "bx-dice-5",
        type: "number",
        description: "A daily number challenge with a configured result."
    },
    {
        id: "high-low",
        name: "High or Low",
        icon: "bx-sort",
        type: "high-low",
        description: "A high-or-low challenge with published instructions."
    },
    {
        id: "odd-even",
        name: "Odd or Even",
        icon: "bx-calculator",
        type: "odd-even",
        description: "An odd-or-even challenge with defined rules."
    },
    {
        id: "daily-challenge",
        name: "Daily Challenge",
        icon: "bx-calendar-star",
        type: "challenge",
        description: "A daily challenge configured by the administrator."
    }
];

const state = {
    games: [],
    results: [],
    pendingConfirmation: null,
    previousFocus: null
};

const $ = (id) => document.getElementById(id);

const ui = {
    sidebar: $("sidebar"),
    sidebarOverlay: $("sidebarOverlay"),
    openSidebar: $("openSidebar"),
    closeSidebar: $("closeSidebar"),

    connectionStatus: $("connectionStatus"),
    backendNotice: $("backendNotice"),
    gamesGrid: $("gamesGrid"),

    dailySettingsForm: $("dailySettingsForm"),
    dailyLimit: $("dailyLimit"),
    resetTime: $("resetTime"),
    serverTimezone: $("serverTimezone"),
    pauseAllGames: $("pauseAllGames"),

    signalForm: $("signalForm"),
    signalGame: $("signalGame"),
    signalDate: $("signalDate"),
    signalTime: $("signalTime"),
    signalMessage: $("signalMessage"),
    signalCount: $("signalCount"),
    previewSignal: $("previewSignal"),
    copySignal: $("copySignal"),
    signalPreview: $("signalPreview"),
    signalPreviewText: $("signalPreviewText"),
    signalPreviewSchedule: $("signalPreviewSchedule"),
    closeSignalPreview: $("closeSignalPreview"),

    resultsTableBody: $("resultsTableBody"),
    refreshResults: $("refreshResults"),

    gameModal: $("gameModal"),
    gameConfigForm: $("gameConfigForm"),
    gameModalTitle: $("gameModalTitle"),
    closeGameModal: $("closeGameModal"),
    cancelGameConfig: $("cancelGameConfig"),
    configGameId: $("configGameId"),
    configGameName: $("configGameName"),
    configDescription: $("configDescription"),
    configInstructions: $("configInstructions"),
    configType: $("configType"),
    configStatus: $("configStatus"),
    configResultDate: $("configResultDate"),
    configAnswer: $("configAnswer"),
    configResultStatus: $("configResultStatus"),
    configSignalMessage: $("configSignalMessage"),
    gameFormMessage: $("gameFormMessage"),
    saveGameConfig: $("saveGameConfig"),

    confirmModal: $("confirmModal"),
    confirmTitle: $("confirmTitle"),
    confirmText: $("confirmText"),
    cancelConfirm: $("cancelConfirm"),
    acceptConfirm: $("acceptConfirm"),

    toast: $("toast"),
    toastText: $("toastText")
};

/* ---------------------------------
   API helpers
---------------------------------- */

function apiConfigured() {
    return typeof GAME_API.baseUrl === "string" &&
        GAME_API.baseUrl.trim().length > 0;
}

function apiUrl(endpoint) {
    if (!apiConfigured()) {
        throw new Error("Backend API is not configured.");
    }

    return new URL(endpoint, GAME_API.baseUrl).toString();
}

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(apiUrl(endpoint), {
        ...options,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...options.headers
        }
    });

    if (!response.ok) {
        throw new Error(`Server request failed (${response.status}).`);
    }

    if (response.status === 204) return null;

    return response.json();
}

function setConnectionStatus(connected) {
    ui.connectionStatus.classList.toggle("connected", connected);

    ui.connectionStatus.lastChild.textContent = connected
        ? " Backend available"
        : " Backend not configured";

    ui.backendNotice.hidden = connected;
}

function showToast(message) {
    ui.toastText.textContent = message;
    ui.toast.hidden = false;
}

function showFormMessage(message, success = false) {
    ui.gameFormMessage.textContent = message;
    ui.gameFormMessage.className =
        success ? "form-message success" : "form-message";
    ui.gameFormMessage.hidden = false;
}

function clearFormMessage() {
    ui.gameFormMessage.textContent = "";
    ui.gameFormMessage.hidden = true;
    ui.gameFormMessage.className = "form-message";
}

/* ---------------------------------
   Date and formatting helpers
---------------------------------- */

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function formatTimestamp(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}

function statusBadge(status) {
    const allowed = ["active", "paused", "draft", "scheduled", "published"];
    const safeStatus = allowed.includes(status) ? status : "draft";

    const labels = {
        active: "Active",
        paused: "Paused",
        draft: "Draft",
        scheduled: "Scheduled",
        published: "Published"
    };

    return `
    <span class="status-badge ${safeStatus}">
      ${labels[safeStatus]}
    </span>
  `;
}

/* ---------------------------------
   Sidebar
---------------------------------- */

function openSidebar() {
    ui.sidebar.classList.add("sidebar-open");
    ui.sidebarOverlay.classList.add("overlay-visible");
    document.body.style.overflow = "hidden";
}

function closeSidebar() {
    ui.sidebar.classList.remove("sidebar-open");
    ui.sidebarOverlay.classList.remove("overlay-visible");
    document.body.style.overflow = "";
}

ui.openSidebar.addEventListener("click", openSidebar);
ui.closeSidebar.addEventListener("click", closeSidebar);
ui.sidebarOverlay.addEventListener("click", closeSidebar);

/* ---------------------------------
   Game cards
---------------------------------- */

function normalizeGame(game) {
    const definition = GAME_DEFINITIONS.find(
        (item) => item.id === game.id
    );

    return {
        ...definition,
        ...game,
        id: definition?.id ?? game.id,
        name: game.name ?? definition?.name ?? "Unnamed game",
        description:
            game.description ??
            definition?.description ??
            "No description provided.",
        type: game.type ?? definition?.type ?? "custom",
        status: game.status === "active" ? "active" : "paused",
        resultStatus: [
            "draft",
            "scheduled",
            "published"
        ].includes(game.resultStatus)
            ? game.resultStatus
            : "draft",
        dailyLimit: 1
    };
}

function renderGames() {
    ui.gamesGrid.innerHTML = "";

    GAME_DEFINITIONS.forEach((definition) => {
        const game = state.games.find(
            (item) => item.id === definition.id
        ) ?? normalizeGame(definition);

        const article = document.createElement("article");
        article.className = "game-card";

        article.innerHTML = `
      <div class="game-card-top">
        <span class="game-icon">
          <i class="bx ${escapeHtml(game.icon || "bx-joystick")}"></i>
        </span>
        ${statusBadge(game.status)}
      </div>

      <h3>${escapeHtml(game.name)}</h3>

      <p class="game-card-description">
        ${escapeHtml(game.description)}
      </p>

      <div class="game-meta">
        <div class="game-meta-row">
          <span>Daily play limit</span>
          <strong>1 attempt</strong>
        </div>

        <div class="game-meta-row">
          <span>Result status</span>
          ${statusBadge(game.resultStatus)}
        </div>

        <div class="game-meta-row">
          <span>Last updated</span>
          <strong>${escapeHtml(formatTimestamp(game.updatedAt))}</strong>
        </div>
      </div>

      <div class="game-card-actions">
        <button type="button" class="btn btn-secondary"
          data-action="configure" data-id="${escapeHtml(game.id)}">
          <i class="bx bx-cog"></i> Configure
        </button>

        <button type="button"
          class="btn ${game.status === "active" ? "btn-danger" : "btn-primary"}"
          data-action="toggle" data-id="${escapeHtml(game.id)}">
          ${game.status === "active" ? "Pause" : "Activate"}
        </button>
      </div>
    `;

        ui.gamesGrid.appendChild(article);
    });
}

async function loadGames() {
    if (!apiConfigured()) {
        state.games = GAME_DEFINITIONS.map((game) => ({
            ...game,
            status: "paused",
            resultStatus: "draft",
            updatedAt: null
        }));

        setConnectionStatus(false);
        renderGames();
        populateSignalGameOptions();
        return;
    }

    try {
        const response = await apiRequest(GAME_API.gamesEndpoint);

        if (!Array.isArray(response?.games)) {
            throw new Error("Unexpected game list response.");
        }

        state.games = response.games.map(normalizeGame);
        setConnectionStatus(true);
        renderGames();
        populateSignalGameOptions();

    } catch (error) {
        console.error("Loading games:", error);
        showToast("Unable to load games from the server.");
    }
}

ui.gamesGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const game = state.games.find(
        (item) => item.id === button.dataset.id
    );

    if (!game) return;

    if (button.dataset.action === "configure") {
        openGameModal(game);
        return;
    }

    if (button.dataset.action === "toggle") {
        const activating = game.status !== "active";

        showConfirmation({
            title: activating ? "Activate game?" : "Pause game?",
            message: activating
                ? `Activate ${game.name}? The backend must confirm this change.`
                : `Pause ${game.name}? This may prevent new plays.`,
            confirmLabel: activating ? "Activate" : "Pause",
            action: async () => {
                if (!apiConfigured()) {
                    showToast("Backend not configured. No game status was changed.");
                    return;
                }

                await apiRequest(
                    `${GAME_API.gamesEndpoint}/${encodeURIComponent(game.id)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            status: activating ? "active" : "paused"
                        })
                    }
                );

                showToast("Game status updated.");
                await loadGames();
            }
        });
    }
});

/* ---------------------------------
   Game configuration modal
---------------------------------- */

function openGameModal(game) {
    clearFormMessage();

    ui.gameConfigForm.reset();

    ui.configGameId.value = game.id;
    ui.configGameName.value = game.name;
    ui.configDescription.value = game.description || "";
    ui.configInstructions.value = game.instructions || "";
    ui.configType.value = game.type || "custom";
    ui.configStatus.value = game.status || "paused";
    ui.configResultDate.value = game.resultDate || localDateString();
    ui.configAnswer.value = game.answer || "";
    ui.configResultStatus.value = game.resultStatus || "draft";
    ui.configSignalMessage.value = game.signalMessage || "";

    ui.gameModalTitle.textContent = `Configure ${game.name}`;
    ui.previousFocus = document.activeElement;

    ui.gameModal.hidden = false;
    document.body.style.overflow = "hidden";

    ui.closeGameModal.focus();
}

function closeGameModal() {
    if (ui.gameModal.hidden) return;

    ui.gameModal.hidden = true;
    restorePageScroll();

    if (ui.previousFocus?.focus) ui.previousFocus.focus();
}

ui.closeGameModal.addEventListener("click", closeGameModal);
ui.cancelGameConfig.addEventListener("click", closeGameModal);

ui.gameModal.addEventListener("click", (event) => {
    if (event.target === ui.gameModal) closeGameModal();
});

ui.gameConfigForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormMessage();

    const gameId = ui.configGameId.value;
    const game = state.games.find((item) => item.id === gameId);

    if (!game) {
        showFormMessage("Select a valid game before saving.");
        return;
    }

    const answer = ui.configAnswer.value.trim();
    const resultStatus = ui.configResultStatus.value;

    if (
        resultStatus === "published" &&
        !answer
    ) {
        showFormMessage("Enter the configured result before publishing.");
        return;
    }

    const payload = {
        name: ui.configGameName.value.trim(),
        description: ui.configDescription.value.trim(),
        instructions: ui.configInstructions.value.trim(),
        type: ui.configType.value,
        status: ui.configStatus.value,
        resultDate: ui.configResultDate.value,
        answer,
        resultStatus,
        signalMessage: ui.configSignalMessage.value.trim(),
        dailyLimit: 1
    };

    if (!payload.name || !payload.resultDate) {
        showFormMessage("Game name and result date are required.");
        return;
    }

    if (resultStatus === "published") {
        showConfirmation({
            title: "Publish configured result?",
            message:
                "Confirm that this is the intended result and that the published game rules accurately describe how it was determined.",
            confirmLabel: "Confirm & Save",
            action: () => saveGameConfiguration(gameId, payload)
        });

        return;
    }

    await saveGameConfiguration(gameId, payload);
});

async function saveGameConfiguration(gameId, payload) {
    if (!apiConfigured()) {
        showFormMessage(
            "Not saved. Configure the backend API before saving game settings."
        );
        return;
    }

    const originalText = ui.saveGameConfig.innerHTML;
    ui.saveGameConfig.disabled = true;
    ui.saveGameConfig.textContent = "Saving...";

    try {
        await apiRequest(
            `${GAME_API.gamesEndpoint}/${encodeURIComponent(gameId)}`,
            {
                method: "PUT",
                body: JSON.stringify(payload)
            }
        );

        showToast("Game configuration saved by the server.");
        closeGameModal();

        await Promise.all([loadGames(), loadResults()]);

    } catch (error) {
        console.error("Saving game configuration:", error);
        showFormMessage(`Could not save configuration: ${error.message}`);
    } finally {
        ui.saveGameConfig.disabled = false;
        ui.saveGameConfig.innerHTML = originalText;
    }
}

/* ---------------------------------
   Daily play settings
---------------------------------- */

ui.dailySettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!apiConfigured()) {
        showToast("Backend not configured. Daily settings were not saved.");
        return;
    }

    const payload = {
        dailyLimit: 1,
        resetTime: ui.resetTime.value,
        timezone: ui.serverTimezone.value,
        paused: ui.pauseAllGames.checked
    };

    try {
        await apiRequest(GAME_API.dailySettingsEndpoint, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        showToast("Daily settings saved by the server.");

    } catch (error) {
        console.error("Saving daily settings:", error);
        showToast(`Could not save daily settings: ${error.message}`);
    }
});

async function loadDailySettings() {
    if (!apiConfigured()) return;

    try {
        const settings = await apiRequest(GAME_API.dailySettingsEndpoint);

        if (settings?.resetTime) {
            ui.resetTime.value = settings.resetTime;
        }

        if (settings?.timezone) {
            ui.serverTimezone.value = settings.timezone;
        }

        ui.pauseAllGames.checked = Boolean(settings?.paused);

    } catch (error) {
        console.error("Loading daily settings:", error);
    }
}

/* ---------------------------------
   Signal and announcement management
---------------------------------- */

function populateSignalGameOptions() {
    const previousValue = ui.signalGame.value;

    ui.signalGame.innerHTML = "";

    GAME_DEFINITIONS.forEach((definition) => {
        const option = document.createElement("option");
        option.value = definition.id;
        option.textContent = definition.name;

        ui.signalGame.appendChild(option);
    });

    if (GAME_DEFINITIONS.some((game) => game.id === previousValue)) {
        ui.signalGame.value = previousValue;
    }
}

function getSignalPayload() {
    const message = ui.signalMessage.value.trim();

    if (!message) {
        throw new Error("Enter an announcement message.");
    }

    if (!ui.signalDate.value || !ui.signalTime.value) {
        throw new Error("Choose a publication date and time.");
    }

    return {
        gameId: ui.signalGame.value,
        publicationDate: ui.signalDate.value,
        publicationTime: ui.signalTime.value,
        message
    };
}

ui.signalMessage.addEventListener("input", () => {
    ui.signalCount.textContent =
        `${ui.signalMessage.value.length} / 2000`;
});

ui.previewSignal.addEventListener("click", () => {
    try {
        const signal = getSignalPayload();

        const selectedGame = GAME_DEFINITIONS.find(
            (game) => game.id === signal.gameId
        );

        ui.signalPreviewText.textContent =
            `${selectedGame?.name || "Game announcement"}\n\n${signal.message}`;

        ui.signalPreviewSchedule.textContent =
            `Scheduled date: ${formatDate(signal.publicationDate)} at ${signal.publicationTime}`;

        ui.signalPreview.hidden = false;

    } catch (error) {
        showToast(error.message);
    }
});

ui.closeSignalPreview.addEventListener("click", () => {
    ui.signalPreview.hidden = true;
});

ui.copySignal.addEventListener("click", async () => {
    try {
        const signal = getSignalPayload();

        const selectedGame = GAME_DEFINITIONS.find(
            (game) => game.id === signal.gameId
        );

        const message = [
            selectedGame?.name || "Game announcement",
            "",
            signal.message,
            "",
            `Date: ${formatDate(signal.publicationDate)}`,
            `Time: ${signal.publicationTime}`
        ].join("\n");

        await navigator.clipboard.writeText(message);
        showToast("Announcement copied. You can share it manually.");

    } catch (error) {
        if (error instanceof Error && error.message) {
            showToast(error.message);
        } else {
            showToast("Clipboard access failed. Check browser permissions.");
        }
    }
});

ui.signalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    let payload;

    try {
        payload = getSignalPayload();
    } catch (error) {
        showToast(error.message);
        return;
    }

    if (!apiConfigured()) {
        showToast("Backend not configured. Announcement was not saved.");
        return;
    }

    try {
        await apiRequest(GAME_API.signalsEndpoint, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showToast("Announcement saved by the server.");

    } catch (error) {
        console.error("Saving announcement:", error);
        showToast(`Could not save announcement: ${error.message}`);
    }
});

/* ---------------------------------
   Daily results table
---------------------------------- */

function renderResults() {
    ui.resultsTableBody.replaceChildren();

    if (!state.results.length) {
        ui.resultsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <i class="bx bx-folder-open"></i>
          <strong>No results available</strong>
          <span>No saved results were returned by the backend.</span>
        </td>
      </tr>
    `;

        return;
    }

    state.results.forEach((result) => {
        const row = document.createElement("tr");

        const game = GAME_DEFINITIONS.find(
            (item) => item.id === result.gameId
        );

        const published = result.status === "published";

        row.innerHTML = `
      <td>${escapeHtml(game?.name || result.gameName || "Game")}</td>
      <td>${escapeHtml(formatDate(result.resultDate))}</td>
      <td class="answer-cell">
        ${published
                ? escapeHtml(result.answer || "—")
                : "Restricted until publication"
            }
      </td>
      <td>${statusBadge(result.status)}</td>
      <td>${escapeHtml(formatTimestamp(result.updatedAt))}</td>
      <td>
        <button type="button" class="btn btn-secondary"
          data-edit-result="${escapeHtml(result.gameId)}"
          data-result-date="${escapeHtml(result.resultDate)}">
          <i class="bx bx-edit"></i> Edit
        </button>
      </td>
    `;

        ui.resultsTableBody.appendChild(row);
    });
}

async function loadResults() {
    if (!apiConfigured()) {
        state.results = [];
        renderResults();
        return;
    }

    try {
        const response = await apiRequest(GAME_API.resultsEndpoint);

        if (!Array.isArray(response?.results)) {
            throw new Error("Unexpected results response.");
        }

        state.results = response.results;
        renderResults();

    } catch (error) {
        console.error("Loading results:", error);

        state.results = [];
        renderResults();
        showToast("Could not load daily results.");
    }
}

ui.refreshResults.addEventListener("click", loadResults);

ui.resultsTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-edit-result]");

    if (!button) return;

    const game = state.games.find(
        (item) => item.id === button.dataset.editResult
    );

    if (!game) {
        showToast("The selected game is unavailable.");
        return;
    }

    if (!apiConfigured()) {
        showToast("Connect the backend to edit saved results.");
        return;
    }

    try {
        const endpoint =
            `${GAME_API.resultsEndpoint}/${encodeURIComponent(game.id)}` +
            `?date=${encodeURIComponent(button.dataset.resultDate)}`;

        const response = await apiRequest(endpoint);

        if (!response?.result) {
            showToast("No editable result was returned.");
            return;
        }

        openGameModal({
            ...game,
            ...response.result
        });

    } catch (error) {
        console.error("Loading result for editing:", error);
        showToast("Could not load the selected result.");
    }
});

/* ---------------------------------
   Confirmation modal
---------------------------------- */

function showConfirmation({
    title,
    message,
    confirmLabel = "Confirm",
    action
}) {
    state.pendingConfirmation = action;

    ui.confirmTitle.textContent = title;
    ui.confirmText.textContent = message;
    ui.acceptConfirm.textContent = confirmLabel;

    ui.confirmModal.hidden = false;
    document.body.style.overflow = "hidden";
}

function closeConfirmation() {
    ui.confirmModal.hidden = true;
    state.pendingConfirmation = null;
    restorePageScroll();
}

ui.cancelConfirm.addEventListener("click", closeConfirmation);

ui.confirmModal.addEventListener("click", (event) => {
    if (event.target === ui.confirmModal) {
        closeConfirmation();
    }
});

ui.acceptConfirm.addEventListener("click", async () => {
    const action = state.pendingConfirmation;

    ui.acceptConfirm.disabled = true;

    try {
        closeConfirmation();

        if (typeof action === "function") {
            await action();
        }

    } catch (error) {
        console.error("Confirmed action failed:", error);
        showToast(`Action failed: ${error.message}`);
    } finally {
        ui.acceptConfirm.disabled = false;
    }
});

/* ---------------------------------
   Shared modal cleanup
---------------------------------- */

function restorePageScroll() {
    if (
        ui.gameModal.hidden &&
        ui.confirmModal.hidden
    ) {
        document.body.style.overflow = "";
    }
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeSidebar();
        closeGameModal();
        closeConfirmation();

        ui.signalPreview.hidden = true;
    }
});

/* ---------------------------------
   Initial setup
---------------------------------- */

ui.signalDate.value = localDateString();
ui.signalTime.value = "12:00";
ui.dailyLimit.value = "1";

populateSignalGameOptions();
loadGames();
loadDailySettings();
loadResults();