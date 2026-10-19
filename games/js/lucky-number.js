
        document.addEventListener("DOMContentLoaded", () => {
            // =============================================
            // KUDIX LUCKY NUMBER - FRONTEND DEMO ONLY
            // =============================================

            const ROUND_SECONDS = 20;
            const FIRST_ROUND = 3001;
            const MIN_AMOUNT = 100;
            const MAX_AMOUNT = 2000;
            const AMOUNT_STEP = 100;
            const HISTORY_LIMIT = 8;

            let currentRound = FIRST_ROUND;
            let selectedNumber = null;
            let selectedAmount = 100;
            let secondsRemaining = ROUND_SECONDS;

            let roundLocked = false;
            let drawing = false;
            let paused = false;
            let soundEnabled = false;

            let timerInterval = null;
            let animationInterval = null;
            let animationTimeout = null;
            let toastTimeout = null;
            let audioContext = null;

            const history = [];

            const stats = {
                draws: 0,
                matches: 0,
                misses: 0,
                expired: 0
            };

            const $ = (id) => document.getElementById(id);

            const numberGrid = $("numberGrid");
            const timerText = $("timerText");
            const timerProgress = $("timerProgress");
            const roundNumber = $("roundNumber");
            const roundStatusText = $("roundStatusText");
            const timerStatus = $("timerStatus");

            const drawButton = $("drawButton");
            const nextRoundButton = $("nextRoundButton");
            const pauseButton = $("pauseButton");
            const pauseIcon = $("pauseIcon");
            const pauseLabel = $("pauseLabel");

            const customAmount = $("customAmount");
            const resultOrb = $("resultOrb");
            const resultNumber = $("resultNumber");
            const resultTitle = $("resultTitle");
            const resultDescription = $("resultDescription");
            const resultBadge = $("resultBadge");

            const mobileMenuButton = $("mobileMenuButton");
            const mobileMenu = $("mobileMenu");
            const mobileMenuIcon = $("mobileMenuIcon");

            // ---------------------------------------------
            // Number grid
            // ---------------------------------------------

            function buildNumberGrid() {
                numberGrid.innerHTML = "";

                for (let number = 1; number <= 20; number++) {
                    const button = document.createElement("button");

                    button.type = "button";
                    button.className = "number-btn";
                    button.textContent = number;
                    button.dataset.number = number;
                    button.setAttribute("aria-label", `Select number ${number}`);
                    button.setAttribute("aria-pressed", "false");

                    button.addEventListener("click", () => {
                        selectNumber(number);
                    });

                    numberGrid.appendChild(button);
                }
            }

            function selectNumber(number) {
                if (roundLocked || paused || drawing) return;

                selectedNumber = number;

                document.querySelectorAll(".number-btn").forEach((button) => {
                    const isSelected = Number(button.dataset.number) === number;

                    button.classList.toggle("selected", isSelected);
                    button.setAttribute("aria-pressed", String(isSelected));
                });

                $("selectedNumberText").textContent = `Number ${number}`;
                $("resultYourPick").textContent = number;
                $("actionHint").textContent = `Number ${number} selected. Start your demo draw when ready.`;

                playTone(520, 0.045);
                updateControls();
            }

            function clearSelection() {
                if (roundLocked || paused || drawing) return;

                selectedNumber = null;

                document.querySelectorAll(".number-btn").forEach((button) => {
                    button.classList.remove("selected");
                    button.setAttribute("aria-pressed", "false");
                });

                $("selectedNumberText").textContent = "No number selected";
                $("resultYourPick").textContent = "—";
                $("actionHint").textContent = "Choose one number to enable your demo draw.";

                updateControls();
            }

            // ---------------------------------------------
            // Amount input
            // This is display-only. It never changes credit.
            // ---------------------------------------------

            function formatNaira(amount) {
                return "₦" + Number(amount).toLocaleString("en-NG");
            }

            function isValidAmount(amount) {
                return (
                    Number.isFinite(amount) &&
                    amount >= MIN_AMOUNT &&
                    amount <= MAX_AMOUNT &&
                    amount % AMOUNT_STEP === 0
                );
            }

            function updateAmountButtons() {
                document.querySelectorAll("[data-amount]").forEach((button) => {
                    const isSelected = Number(button.dataset.amount) === selectedAmount;
                    button.classList.toggle("selected", isSelected);
                    button.setAttribute("aria-pressed", String(isSelected));
                });

                $("resultAmount").textContent = formatNaira(selectedAmount);
            }

            function setAmount(amount) {
                if (roundLocked || drawing) return;

                selectedAmount = amount;
                customAmount.value = String(amount);

                updateAmountButtons();
            }

            document.querySelectorAll("[data-amount]").forEach((button) => {
                button.addEventListener("click", () => {
                    setAmount(Number(button.dataset.amount));
                });
            });

            customAmount.addEventListener("input", () => {
                const amount = Number(customAmount.value);

                if (isValidAmount(amount)) {
                    selectedAmount = amount;
                    updateAmountButtons();
                } else {
                    document.querySelectorAll("[data-amount]").forEach((button) => {
                        button.classList.remove("selected");
                    });
                }
            });

            customAmount.addEventListener("change", () => {
                const amount = Number(customAmount.value);

                if (!isValidAmount(amount)) {
                    showToast("Enter an amount from ₦100 to ₦2,000 in increments of ₦100.", "error");
                    customAmount.value = String(selectedAmount);
                    updateAmountButtons();
                    return;
                }

                selectedAmount = amount;
                updateAmountButtons();
            });

            // ---------------------------------------------
            // Timer
            // ---------------------------------------------

            function renderTimer() {
                timerText.textContent = `00:${String(secondsRemaining).padStart(2, "0")}`;

                const percentage = (secondsRemaining / ROUND_SECONDS) * 100;
                timerProgress.style.width = `${percentage}%`;

                timerProgress.classList.toggle("urgent", secondsRemaining <= 5);

                if (secondsRemaining <= 5 && !roundLocked) {
                    timerText.classList.add("text-rose-300");
                } else {
                    timerText.classList.remove("text-rose-300");
                }
            }

            function startTimer() {
                clearInterval(timerInterval);

                if (roundLocked || paused) return;

                timerInterval = setInterval(() => {
                    if (paused || roundLocked) return;

                    secondsRemaining = Math.max(0, secondsRemaining - 1);
                    renderTimer();

                    if (secondsRemaining <= 5 && secondsRemaining > 0) {
                        playTone(370, 0.035);
                    }

                    if (secondsRemaining === 0) {
                        clearInterval(timerInterval);
                        expireRound();
                    }
                }, 1000);
            }

            function stopTimer() {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            // ---------------------------------------------
            // Sound
            // Audio starts only after the user enables it.
            // ---------------------------------------------

            async function enableSound() {
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

                    if (!AudioContextClass) {
                        showToast("Sound is not supported by this browser.", "error");
                        return false;
                    }

                    if (!audioContext) {
                        audioContext = new AudioContextClass();
                    }

                    if (audioContext.state === "suspended") {
                        await audioContext.resume();
                    }

                    soundEnabled = true;
                    $("soundIcon").className = "bx bx-volume-full text-lg";
                    $("soundLabel").textContent = "Sound On";

                    playTone(620, 0.08);
                    return true;
                } catch (error) {
                    soundEnabled = false;
                    showToast("Could not enable sound in this browser.", "error");
                    return false;
                }
            }

            function playTone(frequency = 440, duration = 0.07) {
                if (!soundEnabled || !audioContext) return;

                try {
                    const oscillator = audioContext.createOscillator();
                    const gain = audioContext.createGain();

                    oscillator.type = "sine";
                    oscillator.frequency.value = frequency;

                    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.015);
                    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

                    oscillator.connect(gain);
                    gain.connect(audioContext.destination);

                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + duration);
                } catch (error) {
                    // The game continues even if audio playback fails.
                }
            }

            $("soundButton").addEventListener("click", async () => {
                if (soundEnabled) {
                    soundEnabled = false;
                    $("soundIcon").className = "bx bx-volume-mute text-lg";
                    $("soundLabel").textContent = "Sound Off";
                    return;
                }

                await enableSound();
            });

            // ---------------------------------------------
            // Pause and resume
            // ---------------------------------------------

            function updatePauseButton() {
                const canPause = !roundLocked && !drawing;

                pauseButton.disabled = !canPause;

                if (paused) {
                    pauseIcon.className = "bx bx-play-circle text-lg";
                    pauseLabel.textContent = "Resume Game";
                    timerStatus.textContent = "Game paused";
                    roundStatusText.textContent = "Paused";
                } else {
                    pauseIcon.className = "bx bx-pause-circle text-lg";
                    pauseLabel.textContent = "Pause Game";

                    if (!roundLocked) {
                        timerStatus.textContent = "Select a number before time runs out";
                        roundStatusText.textContent = "Ready for your selection";
                    }
                }
            }

            pauseButton.addEventListener("click", () => {
                if (roundLocked || drawing) return;

                paused = !paused;

                if (paused) {
                    stopTimer();
                    $("actionHint").textContent = "Game paused. Resume when you are ready.";
                    showToast("Practice round paused.");
                } else {
                    $("actionHint").textContent = selectedNumber === null
                        ? "Choose one number to enable your demo draw."
                        : `Number ${selectedNumber} selected. Continue your demo round.`;

                    startTimer();
                    showToast("Practice round resumed.", "success");
                }

                updatePauseButton();
                updateControls();
            });

            // ---------------------------------------------
            // Result state
            // ---------------------------------------------

            function resetResultPanel() {
                resultOrb.classList.remove("match", "no-match", "draw-animation");
                resultNumber.textContent = "?";
                resultTitle.textContent = "Your number awaits";
                resultDescription.textContent = "Select a number from the grid, then press Draw Lucky Number.";

                resultBadge.textContent = "Waiting";
                resultBadge.className =
                    "rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300";

                $("resultYourPick").textContent = "—";
                $("resultDrawnPick").textContent = "—";
                $("resultRoundNumber").textContent = `#${currentRound}`;
                $("resultAmount").textContent = formatNaira(selectedAmount);
            }

            function updateControls() {
                const canInteract = !roundLocked && !paused && !drawing;

                document.querySelectorAll(".number-btn").forEach((button) => {
                    button.disabled = !canInteract;
                });

                document.querySelectorAll("[data-amount]").forEach((button) => {
                    button.disabled = !canInteract;
                });

                customAmount.disabled = !canInteract;

                drawButton.disabled =
                    !canInteract ||
                    selectedNumber === null ||
                    !isValidAmount(selectedAmount);

                nextRoundButton.disabled = !roundLocked || drawing;
                $("clearSelectionButton").disabled = !canInteract;

                updatePauseButton();
            }

            function lockRound(status) {
                if (roundLocked) return false;

                roundLocked = true;
                stopTimer();

                if (status) {
                    roundStatusText.textContent = status;
                }

                updateControls();
                return true;
            }

            // ---------------------------------------------
            // Draw
            // ---------------------------------------------

            function startDraw() {
                if (roundLocked || paused || drawing) return;

                if (selectedNumber === null) {
                    showToast("Please select a number first.", "error");
                    return;
                }

                const amount = Number(customAmount.value);

                if (!isValidAmount(amount)) {
                    showToast("Enter a valid practice amount from ₦100 to ₦2,000.", "error");
                    return;
                }

                selectedAmount = amount;
                updateAmountButtons();

                if (!lockRound("Drawing your number...")) return;

                drawing = true;
                paused = false;

                updateControls();

                drawButton.innerHTML =
                    '<i class="bx bx-loader-alt bx-spin text-xl"></i> Drawing...';

                resultOrb.classList.remove("match", "no-match");
                resultOrb.classList.add("draw-animation");

                resultBadge.textContent = "Drawing";
                resultTitle.textContent = "Revealing your number...";
                resultDescription.textContent = "Your demo result is being generated locally.";
                $("actionHint").textContent = "Please wait for the result reveal.";

                playTone(460, 0.06);

                // Clear any stale animation before starting a new one.
                clearInterval(animationInterval);
                clearTimeout(animationTimeout);

                animationInterval = setInterval(() => {
                    resultNumber.textContent = String(Math.floor(Math.random() * 20) + 1);
                    playTone(280 + Math.floor(Math.random() * 180), 0.025);
                }, 85);

                animationTimeout = setTimeout(() => {
                    clearInterval(animationInterval);
                    animationInterval = null;
                    animationTimeout = null;

                    // One final random result, generated locally in the browser.
                    const drawnNumber = Math.floor(Math.random() * 20) + 1;
                    const isMatch = drawnNumber === selectedNumber;

                    finishDraw(drawnNumber, isMatch);
                }, 1400);
            }

            function finishDraw(drawnNumber, isMatch) {
                if (!drawing) return;

                drawing = false;

                resultOrb.classList.remove("draw-animation");
                resultOrb.classList.toggle("match", isMatch);
                resultOrb.classList.toggle("no-match", !isMatch);

                resultNumber.textContent = String(drawnNumber);
                $("resultDrawnPick").textContent = String(drawnNumber);
                $("resultYourPick").textContent = String(selectedNumber);

                resultBadge.textContent = isMatch ? "Exact Match" : "No Match";
                resultBadge.className = isMatch
                    ? "rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                    : "rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-300";

                resultTitle.textContent = isMatch ? "LUCKY MATCH!" : "NO MATCH THIS ROUND";
                resultDescription.textContent = isMatch
                    ? `Your selection matched the drawn number ${drawnNumber}. This is a demo outcome only.`
                    : `You selected ${selectedNumber}, and the drawn number was ${drawnNumber}. Try another practice round if you wish.`;

                roundStatusText.textContent = isMatch ? "Exact match recorded" : "Draw completed";
                timerStatus.textContent = "Round complete";
                $("actionHint").textContent = "Round completed. You can start the next demo round.";

                stats.draws += 1;

                if (isMatch) {
                    stats.matches += 1;
                    playTone(760, 0.16);
                } else {
                    stats.misses += 1;
                    playTone(240, 0.12);
                }

                addHistory({
                    round: currentRound,
                    selected: selectedNumber,
                    drawn: drawnNumber,
                    status: isMatch ? "match" : "miss"
                });

                updateStats();
                updateControls();

                drawButton.innerHTML = '<i class="bx bx-check-circle text-xl"></i> Draw Complete';

                showToast(
                    isMatch ? "Exact match recorded in demo mode!" : "Demo draw completed.",
                    isMatch ? "success" : ""
                );
            }

            function expireRound() {
                if (roundLocked || drawing) return;

                lockRound("Round expired");

                roundStatusText.textContent = "Round expired";
                timerStatus.textContent = "Time is up";

                resultBadge.textContent = "Expired";
                resultBadge.className =
                    "rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300";

                resultOrb.classList.remove("match", "no-match", "draw-animation");
                resultNumber.textContent = "—";
                resultTitle.textContent = "ROUND EXPIRED — NO DRAW";
                resultDescription.textContent =
                    "The timer reached zero before a draw was completed. Start a new round to continue practicing.";

                $("resultYourPick").textContent =
                    selectedNumber === null ? "—" : String(selectedNumber);
                $("resultDrawnPick").textContent = "—";

                $("actionHint").textContent = "This round has expired. Start the next round when ready.";

                stats.expired += 1;

                addHistory({
                    round: currentRound,
                    selected: selectedNumber,
                    drawn: null,
                    status: "expired"
                });

                updateStats();
                updateControls();

                drawButton.innerHTML = '<i class="bx bx-time text-xl"></i> Round Expired';

                showToast("Round expired. No draw was made.");
            }

            drawButton.addEventListener("click", startDraw);

            // ---------------------------------------------
            // Next round
            // ---------------------------------------------

            function nextRound() {
                if (!roundLocked || drawing) return;

                clearInterval(animationInterval);
                clearTimeout(animationTimeout);
                stopTimer();

                animationInterval = null;
                animationTimeout = null;

                currentRound += 1;
                secondsRemaining = ROUND_SECONDS;

                selectedNumber = null;
                roundLocked = false;
                drawing = false;
                paused = false;

                document.querySelectorAll(".number-btn").forEach((button) => {
                    button.classList.remove("selected");
                    button.setAttribute("aria-pressed", "false");
                });

                $("selectedNumberText").textContent = "No number selected";
                $("actionHint").textContent = "Choose one number to enable your demo draw.";

                roundNumber.textContent = `#${currentRound}`;
                $("resultRoundNumber").textContent = `#${currentRound}`;
                roundStatusText.textContent = "Ready for your selection";

                drawButton.innerHTML = '<i class="bx bx-dice-5 text-xl"></i> Draw Lucky Number';

                resetResultPanel();
                renderTimer();
                updateControls();
                startTimer();

                showToast(`Round #${currentRound} is ready.`, "success");

                $("game").scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                    block: "start"
                });
            }

            nextRoundButton.addEventListener("click", nextRound);

            // ---------------------------------------------
            // History
            // ---------------------------------------------

            function addHistory(entry) {
                history.unshift(entry);

                if (history.length > HISTORY_LIMIT) {
                    history.length = HISTORY_LIMIT;
                }

                renderHistory();
            }

            function renderHistory() {
                const historyList = $("historyList");

                $("historyCount").textContent =
                    `${history.length} round${history.length === 1 ? "" : "s"} recorded`;

                if (history.length === 0) {
                    historyList.innerHTML = `
            <div class="py-10 text-center">
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-500">
                <i class="bx bx-history text-2xl"></i>
              </div>
              <p class="mt-3 text-sm font-semibold text-slate-300">No rounds yet</p>
              <p class="mt-1 text-xs text-slate-500">Your demo results will appear here.</p>
            </div>
          `;
                    return;
                }

                historyList.innerHTML = history.map((entry) => {
                    const isMatch = entry.status === "match";
                    const isExpired = entry.status === "expired";

                    const numberClass = isMatch
                        ? "history-number match"
                        : isExpired
                            ? "history-number expired"
                            : "history-number";

                    const statusClass = isMatch
                        ? "history-status match"
                        : isExpired
                            ? "history-status expired"
                            : "history-status miss";

                    const statusText = isMatch
                        ? "MATCH"
                        : isExpired
                            ? "EXPIRED"
                            : "NO MATCH";

                    const outcomeText = isExpired
                        ? "No draw made"
                        : `Your pick: ${entry.selected ?? "—"}`;

                    const drawnText = entry.drawn === null
                        ? "—"
                        : String(entry.drawn);

                    return `
            <div class="history-row">
              <div class="min-w-0">
                <p class="round-label text-xs font-bold text-slate-200">Round #${entry.round}</p>
                <p class="mt-1 truncate text-[10px] text-slate-500">${outcomeText}</p>
              </div>
              <div class="flex justify-center">
                <span class="${numberClass}">${drawnText}</span>
              </div>
              <div class="flex justify-center">
                <span class="${statusClass}">${statusText}</span>
              </div>
            </div>
          `;
                }).join("");
            }

            // ---------------------------------------------
            // Session statistics
            // ---------------------------------------------

            function updateStats() {
                $("statDraws").textContent = stats.draws;
                $("statMatches").textContent = stats.matches;
                $("statMisses").textContent = stats.misses;
                $("statExpired").textContent = stats.expired;
            }

            // ---------------------------------------------
            // Toast notifications
            // ---------------------------------------------

            function showToast(message, type = "") {
                const toast = $("toast");

                clearTimeout(toastTimeout);

                toast.textContent = message;
                toast.className = "toast";

                if (type) {
                    toast.classList.add(type);
                }

                // Force reflow so the transition also works on repeated messages.
                void toast.offsetWidth;

                toast.classList.add("show");

                toastTimeout = setTimeout(() => {
                    toast.classList.remove("show");
                }, 2800);
            }

            // ---------------------------------------------
            // Mobile navigation
            // ---------------------------------------------

            function closeMobileMenu() {
                mobileMenu.classList.remove("open");
                mobileMenuButton.setAttribute("aria-expanded", "false");
                mobileMenuButton.setAttribute("aria-label", "Open navigation menu");
                mobileMenuIcon.className = "bx bx-menu text-2xl";
            }

            mobileMenuButton.addEventListener("click", () => {
                const isOpen = mobileMenu.classList.toggle("open");

                mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
                mobileMenuButton.setAttribute(
                    "aria-label",
                    isOpen ? "Close navigation menu" : "Open navigation menu"
                );

                mobileMenuIcon.className = isOpen
                    ? "bx bx-x text-2xl"
                    : "bx bx-menu text-2xl";
            });

            mobileMenu.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", closeMobileMenu);
            });

            window.addEventListener("resize", () => {
                if (window.innerWidth >= 768) {
                    closeMobileMenu();
                }
            });

            // ---------------------------------------------
            // Clear selection, initial setup and cleanup
            // ---------------------------------------------

            $("clearSelectionButton").addEventListener("click", clearSelection);

            $("currentYear").textContent = new Date().getFullYear();

            buildNumberGrid();
            renderTimer();
            updateAmountButtons();
            resetResultPanel();
            updateControls();
            renderHistory();
            updateStats();
            startTimer();

            // Keep the countdown and animations tidy if the page is left.
            window.addEventListener("pagehide", () => {
                stopTimer();
                clearInterval(animationInterval);
                clearTimeout(animationTimeout);
                clearTimeout(toastTimeout);
            });
        });
