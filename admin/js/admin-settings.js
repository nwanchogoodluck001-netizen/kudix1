
        "use strict";

        /*
         * KUDIX ADMIN SETTINGS
         *
         * Backend integration contract:
         *
         * Provide window.KUDIX_ADMIN_API from your existing application.
         *
         * getSettings():
         *   Returns {
         *     settings: { ... },
         *     system: {
         *       version, environment, lastUpdated, updatedBy
         *     }
         *   }
         *
         * updateSettings(changes):
         *   Persists changes and resolves only after server confirmation.
         *
         * resetSettingsSection(section):
         *   Optional. Restores backend-defined defaults for one section.
         *
         * The settings API must enforce administrator authorization,
         * validate all values, and audit sensitive changes server-side.
         *
         * Do not insert fake settings or pretend that a save succeeded.
         */

        const form = document.getElementById("settingsForm");
        const settingElements = [...form.querySelectorAll("[data-setting]")];

        const saveBtn = document.getElementById("saveBtn");
        const topSaveBtn = document.getElementById("topSaveBtn");
        const discardBtn = document.getElementById("discardBtn");
        const refreshBtn = document.getElementById("refreshBtn");

        const saveMessage = document.getElementById("saveMessage");
        const integrationNotice = document.getElementById("integrationNotice");
        const integrationTitle = document.getElementById("integrationTitle");
        const integrationDescription = document.getElementById("integrationDescription");

        let originalSettings = {};
        let loaded = false;
        let loading = false;
        let saving = false;
        let pendingConfirmation = null;
        let lastFocusedElement = null;

        const sectionMap = {
            general: [
                "platformName",
                "platformEmail",
                "platformDescription",
                "websiteUrl",
                "supportUrl",
                "defaultCurrency",
                "defaultTimezone",
                "maintenanceMode",
                "maintenanceMessage"
            ],
            accounts: [
                "registrationEnabled",
                "emailVerificationRequired",
                "accountUpgradesEnabled",
                "referralsEnabled",
                "sessionTimeout",
                "minimumAge"
            ],
            referrals: [
                "referralReward",
                "activityReward",
                "upgradeThreshold",
                "minimumReferrals",
                "adminBalanceAdjustmentsEnabled"
            ],
            security: [
                "adminTwoFactorRequired",
                "adminLoginNotifications",
                "securityEventLogging",
                "maxLoginAttempts",
                "lockoutDuration"
            ],
            notifications: [
                "notificationEmail",
                "notifyNewRegistrations",
                "notifyNewSupportTickets",
                "notifyAccountSuspensions",
                "notifySecurityAlerts",
                "notifyPlatformEvents"
            ],
            support: [
                "supportEmail",
                "supportContactUrl",
                "defaultTicketStatus",
                "supportTicketsEnabled",
                "supportTicketNotifications"
            ]
        };

        function getApi() {
            return window.KUDIX_ADMIN_API || null;
        }

        function getElementKey(element) {
            return element.name || element.id;
        }

        function readValue(element) {
            if (element.type === "checkbox") {
                return element.checked;
            }

            if (element.type === "number") {
                return element.value === "" ? "" : Number(element.value);
            }

            return element.value;
        }

        function setValue(element, value) {
            if (element.type === "checkbox") {
                element.checked = value === true;
                return;
            }

            element.value = value == null ? "" : String(value);
        }

        function collectSettings() {
            const values = {};

            settingElements.forEach(element => {
                values[getElementKey(element)] = readValue(element);
            });

            return values;
        }

        function applySettings(settings) {
            settingElements.forEach(element => {
                const key = getElementKey(element);

                if (Object.prototype.hasOwnProperty.call(settings, key)) {
                    setValue(element, settings[key]);
                }
            });

            originalSettings = collectSettings();
            loaded = true;
            clearValidation();
            updateDirtyState();
        }

        function getChanges() {
            const current = collectSettings();
            const changes = {};

            Object.keys(current).forEach(key => {
                if (!Object.is(current[key], originalSettings[key])) {
                    changes[key] = current[key];
                }
            });

            return changes;
        }

        function hasChanges() {
            return Object.keys(getChanges()).length > 0;
        }

        function setSaveMessage(message, unsaved = false) {
            saveMessage.classList.toggle("unsaved", unsaved);

            saveMessage.innerHTML = "";

            const icon = document.createElement("i");
            icon.className = unsaved ? "bx bx-error-circle" : "bx bx-info-circle";

            const text = document.createElement("span");
            text.textContent = message;

            saveMessage.append(icon, text);
        }

        function setTopbarStatus(message, state = "neutral") {
            document.getElementById("topbarStatusText").textContent = message;

            const dot = document.getElementById("topbarStatusDot");
            dot.className = "status-dot";

            if (state === "success") {
                dot.classList.add("success");
            } else if (state === "error") {
                dot.classList.add("error");
            }
        }

        function updateDirtyState() {
            const dirty = loaded && hasChanges();
            const disabled = !loaded || loading || saving;

            saveBtn.disabled = disabled || !dirty;
            topSaveBtn.disabled = disabled || !dirty;
            discardBtn.disabled = disabled || !dirty;

            if (saving) {
                setSaveMessage("Saving configuration…");
            } else if (dirty) {
                setSaveMessage("You have unsaved changes.", true);
            } else if (loaded) {
                setSaveMessage("All changes are saved.");
            } else {
                setSaveMessage("Waiting for configuration to load.");
            }
        }

        function showToast(title, message, type = "success") {
            const container = document.getElementById("toastContainer");
            const toast = document.createElement("div");

            toast.className = "toast" + (type === "error" ? " error" : "");

            const icon = document.createElement("i");
            icon.className = type === "error"
                ? "bx bx-x-circle"
                : "bx bx-check-circle";

            const content = document.createElement("div");
            const heading = document.createElement("strong");
            const description = document.createElement("p");

            heading.textContent = title;
            description.textContent = message;

            content.append(heading, description);
            toast.append(icon, content);
            container.appendChild(toast);

            window.setTimeout(() => toast.remove(), 6000);
        }

        function showIntegrationState(connected, message = "") {
            integrationNotice.classList.toggle("connected", connected);

            if (connected) {
                integrationTitle.textContent = "Backend configuration connected";
                integrationDescription.textContent =
                    message || "Configuration was loaded from the KUDIX backend.";
                setTopbarStatus("Configuration loaded", "success");
            } else {
                integrationTitle.textContent = "Backend integration required";
                integrationDescription.textContent = message ||
                    "The settings API is unavailable. Changes cannot be saved until the backend is connected.";
                setTopbarStatus("Not connected", "error");
            }
        }

        function formatDate(value) {
            if (!value) return "Unavailable";

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return "Unavailable";
            }

            return new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(date);
        }

        function updateSystemInfo(system = {}) {
            document.getElementById("systemVersion").textContent =
                system.version || "Unavailable";

            document.getElementById("systemEnvironment").textContent =
                system.environment || "Unavailable";

            document.getElementById("lastUpdated").textContent =
                formatDate(system.lastUpdated);

            document.getElementById("updatedBy").textContent =
                system.updatedBy || "Unavailable";

            const connectivity = document.getElementById("systemConnectivity");
            connectivity.replaceChildren();

            const dot = document.createElement("span");
            dot.className = "status-dot success";

            const label = document.createElement("span");
            label.textContent = "Connected";

            connectivity.append(dot, label);
        }

        function setLoadingState(value) {
            loading = value;
            refreshBtn.disabled = value || saving;
            updateDirtyState();
        }

        async function loadSettings(options = {}) {
            const api = getApi();

            if (!api || typeof api.getSettings !== "function") {
                loaded = false;

                showIntegrationState(
                    false,
                    "Connect window.KUDIX_ADMIN_API.getSettings() to your existing authenticated settings API. No settings have been fabricated or saved."
                );

                updateDirtyState();
                return;
            }

            if (hasChanges() && !options.discardChanges) {
                const confirmed = await askConfirmation({
                    title: "Discard unsaved changes?",
                    description: "Refreshing will replace your unsaved form values with the latest server configuration.",
                    confirmText: "Refresh Settings"
                });

                if (!confirmed) return;
            }

            setLoadingState(true);

            try {
                const response = await api.getSettings();

                if (!response || !response.settings) {
                    throw new Error("The backend returned an invalid settings response.");
                }

                applySettings(response.settings);
                updateSystemInfo(response.system || {});
                showIntegrationState(true);

                showToast(
                    "Settings loaded",
                    "The latest available configuration has been loaded."
                );
            } catch (error) {
                showIntegrationState(
                    false,
                    error.message || "Unable to load configuration from the backend."
                );

                showToast(
                    "Unable to load settings",
                    error.message || "The server request failed.",
                    "error"
                );
            } finally {
                setLoadingState(false);
            }
        }

        function clearValidation() {
            form.querySelectorAll(".field.invalid").forEach(field => {
                field.classList.remove("invalid");
            });
        }

        function validateForm() {
            clearValidation();

            let valid = true;
            let firstInvalid = null;

            const urlFields = [
                "websiteUrl",
                "supportUrl",
                "supportContactUrl"
            ];

            settingElements.forEach(element => {
                if (element.type === "checkbox" || element.value === "") {
                    return;
                }

                let fieldValid = true;
                const field = element.closest(".field");

                if (element.type === "email") {
                    fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(element.value);
                }

                if (urlFields.includes(element.id)) {
                    try {
                        const url = new URL(element.value);
                        fieldValid = url.protocol === "https:";
                    } catch {
                        fieldValid = false;
                    }
                }

                if (element.type === "number") {
                    const number = Number(element.value);
                    const min = element.min === "" ? -Infinity : Number(element.min);
                    const max = element.max === "" ? Infinity : Number(element.max);

                    fieldValid =
                        Number.isFinite(number) &&
                        number >= min &&
                        number <= max;

                    if (element.step === "1") {
                        fieldValid = fieldValid && Number.isInteger(number);
                    }
                }

                if (!fieldValid) {
                    valid = false;

                    if (field) {
                        field.classList.add("invalid");
                    }

                    if (!firstInvalid) {
                        firstInvalid = element;
                    }
                }
            });

            if (!valid && firstInvalid) {
                firstInvalid.focus();
                firstInvalid.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                showToast(
                    "Check your entries",
                    "Correct the highlighted fields before saving.",
                    "error"
                );
            }

            return valid;
        }

        async function saveSettings() {
            if (!loaded || saving || !hasChanges()) return;

            const api = getApi();

            if (!api || typeof api.updateSettings !== "function") {
                showToast(
                    "Backend not connected",
                    "No settings have been saved. Connect the existing authorized update API first.",
                    "error"
                );
                return;
            }

            if (!validateForm()) return;

            const changes = getChanges();

            if (Object.prototype.hasOwnProperty.call(changes, "maintenanceMode")
                && changes.maintenanceMode === true) {

                const confirmed = await askConfirmation({
                    title: "Enable maintenance mode?",
                    description: "This may restrict normal user access. Confirm that the backend preserves authorized administrator access and that the maintenance notice is ready.",
                    confirmText: "Continue"
                });

                if (!confirmed) return;
            }

            saving = true;
            saveBtn.disabled = true;
            topSaveBtn.disabled = true;
            refreshBtn.disabled = true;

            updateDirtyState();
            setTopbarStatus("Saving configuration");

            try {
                const response = await api.updateSettings(changes);

                if (!response || response.success !== true) {
                    throw new Error(
                        response && response.message
                            ? response.message
                            : "The backend did not confirm that the changes were saved."
                    );
                }

                if (response.settings) {
                    applySettings(response.settings);
                } else {
                    originalSettings = collectSettings();
                }

                if (response.system) {
                    updateSystemInfo(response.system);
                }

                showIntegrationState(true);
                updateDirtyState();

                showToast(
                    "Settings saved",
                    "The backend confirmed that the configuration was updated."
                );

            } catch (error) {
                setTopbarStatus("Save failed", "error");

                showToast(
                    "Unable to save settings",
                    error.message || "The server request failed. Your edits have been preserved.",
                    "error"
                );
            } finally {
                saving = false;
                refreshBtn.disabled = false;
                updateDirtyState();
            }
        }

        async function discardChanges() {
            if (!hasChanges()) return;

            const confirmed = await askConfirmation({
                title: "Discard your changes?",
                description: "All unsaved edits will be replaced with the last loaded configuration.",
                confirmText: "Discard Changes"
            });

            if (!confirmed) return;

            applySettings(originalSettings);

            showToast(
                "Changes discarded",
                "The form has been restored to the last loaded configuration."
            );
        }

        function askConfirmation({
            title,
            description,
            confirmText = "Confirm",
            danger = false
        }) {
            return new Promise(resolve => {
                const backdrop = document.getElementById("confirmDialog");
                const confirmButton = document.getElementById("dialogConfirm");
                const cancelButton = document.getElementById("dialogCancel");

                lastFocusedElement = document.activeElement;
                pendingConfirmation = resolve;

                document.getElementById("dialogTitle").textContent = title;
                document.getElementById("dialogDescription").textContent = description;

                confirmButton.textContent = confirmText;
                confirmButton.className = danger
                    ? "btn btn-danger"
                    : "btn btn-primary";

                backdrop.classList.add("open");
                confirmButton.focus();
            });
        }

        function closeConfirmation(result) {
            const backdrop = document.getElementById("confirmDialog");

            backdrop.classList.remove("open");

            if (pendingConfirmation) {
                const resolve = pendingConfirmation;
                pendingConfirmation = null;
                resolve(result);
            }

            if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
                lastFocusedElement.focus();
            }
        }

        /*
         * Mark changes without silently enabling unsupported backend features.
         */
        settingElements.forEach(element => {
            element.addEventListener("change", () => {
                const section = element.closest(".settings-card");

                if (element.dataset.confirm === "maintenance" && element.checked) {
                    element.checked = false;

                    askConfirmation({
                        title: "Enable maintenance mode?",
                        description: "Maintenance mode may restrict normal platform access. Continue only if the backend supports it and preserves authorized administrator access.",
                        confirmText: "Enable Maintenance"
                    }).then(confirmed => {
                        if (confirmed) {
                            element.checked = true;
                            updateDirtyState();
                        }
                    });

                    return;
                }

                updateDirtyState();

                if (section) {
                    section.style.borderColor = hasChanges()
                        ? "var(--border-light)"
                        : "var(--border)";
                }
            });

            element.addEventListener("input", () => {
                const field = element.closest(".field");

                if (field) {
                    field.classList.remove("invalid");
                }

                updateDirtyState();
            });
        });

        saveBtn.addEventListener("click", saveSettings);
        topSaveBtn.addEventListener("click", saveSettings);
        discardBtn.addEventListener("click", discardChanges);

        refreshBtn.addEventListener("click", () => {
            loadSettings();
        });

        document.getElementById("dialogCancel").addEventListener("click", () => {
            closeConfirmation(false);
        });

        document.getElementById("dialogConfirm").addEventListener("click", () => {
            closeConfirmation(true);
        });

        document.getElementById("confirmDialog").addEventListener("click", event => {
            if (event.target.id === "confirmDialog") {
                closeConfirmation(false);
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                const dialog = document.getElementById("confirmDialog");

                if (dialog.classList.contains("open")) {
                    closeConfirmation(false);
                }
            }
        });

        /*
         * Unsaved-change protection.
         */
        window.addEventListener("beforeunload", event => {
            if (hasChanges()) {
                event.preventDefault();
                event.returnValue = "";
            }
        });

        /*
         * Settings section navigation.
         */
        const sectionLinks = [
            ...document.querySelectorAll(".settings-nav a")
        ];

        sectionLinks.forEach(link => {
            link.addEventListener("click", () => {
                sectionLinks.forEach(item => item.classList.remove("active"));
                link.classList.add("active");
            });
        });

        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver(entries => {
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (!visible) return;

                sectionLinks.forEach(link => {
                    link.classList.toggle(
                        "active",
                        link.getAttribute("href") === "#" + visible.target.id
                    );
                });
            }, {
                rootMargin: "-100px 0px -60% 0px",
                threshold: [0, .2, .5]
            });

            document.querySelectorAll(".settings-card").forEach(section => {
                observer.observe(section);
            });
        }

        /*
         * Mobile sidebar.
         */
        const sidebar = document.getElementById("sidebar");
        const menuToggle = document.getElementById("menuToggle");
        const mobileOverlay = document.getElementById("mobileOverlay");

        function closeSidebar() {
            sidebar.classList.remove("open");
            mobileOverlay.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation");
        }

        menuToggle.addEventListener("click", () => {
            const isOpen = sidebar.classList.toggle("open");

            mobileOverlay.classList.toggle("open", isOpen);
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation" : "Open navigation"
            );
        });

        mobileOverlay.addEventListener("click", closeSidebar);

        sidebar.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 850) {
                    closeSidebar();
                }
            });
        });

        /*
         * Start with no invented settings or system statistics.
         * Real values must come from the existing backend.
         */
        loadSettings();
