
        document.addEventListener("DOMContentLoaded", () => {
            // =============================================
            // KUDIX HIGHER OR LOWER
            // Frontend-only practice game
            // =============================================

            const ROUND_SECONDS = 20;
            const FIRST_ROUND = 4001;
            const MIN_NUMBER = 1;
            const MAX_NUMBER = 100;
            const MIN_AMOUNT = 100;
            const MAX_AMOUNT = 2000;
            const AMOUNT_STEP = 100;
            const HISTORY_LIMIT = 8;

            let round = FIRST_ROUND;
            let currentNumber = randomNumber();
            let selectedPrediction = null;
            let selectedAmount = 100;
            let secondsRemaining = ROUND_SECONDS;

            let roundLocked = false;
            let resolving = false;
            let paused = false;
            let soundEnabled = false;

            let timerInterval = null;
            let revealInterval = null;
            let revealTimeout = null;
            let toastTimeout = null;
            let audioContext = null;

            const history = [];

            const stats = {
                completed: 0,
                correct: 0,
                incorrect: 0,
                same: 0,
                expired: 0
            };

            const $ = (id) => document.getElementById(id);

            const timerText = $("timerText");
            const timerProgress = $("timerProgress");
            const numberOrb = $("numberOrb");
            const currentNumberElement = $("currentNumber");
            const higherButton = $("higherButton");
            const lowerButton = $("lowerButton");
            const pauseButton = $("pauseButton");
            const nextRoundButton = $("nextRoundButton");
            const drawControls = [higherButton, lowerButton];

            function randomNumber() {
                return Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1)) + MIN_NUMBER;
            }

            function formatNaira(amount) {
                return "₦" + Number(amount).toLocaleString("en-NG");
            }

            function isValidAmount(amount) {
                return Number.isFinite(amount) &&
                    amount >= MIN_AMOUNT &&
                    amount <= MAX_AMOUNT &&
                    amount % AMOUNT_STEP === 0;
            }

            // ---------------------------------------------
            // Initial number and round display
            // ---------------------------------------------

            function renderCurrentNumber() {
                currentNumberElement.textContent = currentNumber;
                $("stageRound").textContent = `#${round}`;
                $("roundNumber").textContent = `#${round}`;
                $("resultRound").textContent = `#${round}`;

                updatePredictionAvailability();
            }

            function updatePredictionAvailability() {
                const canPredict = !roundLocked && !paused && !resolving;

                higherButton.disabled = !canPredict || currentNumber >= MAX_NUMBER;
                lowerButton.disabled = !canPredict || currentNumber <= MIN_NUMBER;

                higherButton.classList.toggle("selected", selectedPrediction === "higher");
                lowerButton.classList.toggle("selected", selectedPrediction === "lower");

                higherButton.setAttribute("aria-pressed", String(selectedPrediction === "higher"));
                lowerButton.setAttribute("aria-pressed", String(selectedPrediction === "lower"));

                if (!roundLocked && !paused && !resolving) {
                    if (currentNumber === MAX_NUMBER) {
                        $("predictionHint").textContent = "Higher unavailable at 100";
                    } else if (currentNumber === MIN_NUMBER) {
                        $("predictionHint").textContent = "Lower unavailable at 1";
                    } else {
                        $("predictionHint").textContent = "Choose one option";
                    }
                }
            }

            // ---------------------------------------------
            // Practice amount: display only
            // ---------------------------------------------

            function updateAmountButtons() {
                document.querySelectorAll("[data-amount]").forEach((button) => {
                    const isSelected = Number(button.dataset.amount) === selectedAmount;
                    button.classList.toggle("selected", isSelected);
                    button.setAttribute("aria-pressed", String(isSelected));
                    button.disabled = roundLocked || resolving;
                });

                $("resultAmount").textContent = formatNaira(selectedAmount);
            }

            function setAmount(amount) {
                if (roundLocked || resolving) return;

                if (!isValidAmount(amount)) {
                    showToast("Choose an amount from ₦100 to ₦2,000 in increments of ₦100.", "error");
                    return;
                }

                selectedAmount = amount;
                $("customAmount").value = String(amount);
                updateAmountButtons();
            }

            document.querySelectorAll("[data-amount]").forEach((button) => {
                button.addEventListener("click", () => {
                    setAmount(Number(button.dataset.amount));
                });
            });

            $("customAmount").addEventListener("input", () => {
                const amount = Number($("customAmount").value);

                if (isValidAmount(amount)) {
                    selectedAmount = amount;
                    updateAmountButtons();
                } else {
                    document.querySelectorAll("[data-amount]").forEach((button) => {
                        button.classList.remove("selected");
                    });
                }
            });

            $("customAmount").addEventListener("change", () => {
                const amount = Number($("customAmount").value);

                if (!isValidAmount(amount)) {
                    showToast("Enter ₦100–₦2,000 in increments of ₦100.", "error");
                    $("customAmount").value = String(selectedAmount);
                    updateAmountButtons();
                    return;
                }

                selectedAmount = amount;
                updateAmountButtons();
            });

            // ---------------------------------------------
            // Countdown timer
            // ---------------------------------------------

            function renderTimer() {
                timerText.textContent = `00:${String(secondsRemaining).padStart(2, "0")}`;

                const percentage = (secondsRemaining / ROUND_SECONDS) * 100;
                timerProgress.style.width = `${percentage}%`;
                timerProgress.classList.toggle("urgent", secondsRemaining <= 5);

                timerText.classList.toggle(
                    "text-rose-300",
                    secondsRemaining <= 5 && !roundLocked
                );
            }

            function startTimer() {
                stopTimer();

                if (roundLocked || paused || resolving) return;

                timerInterval = setInterval(() => {
                    if (roundLocked || paused || resolving) return;

                    secondsRemaining = Math.max(0, secondsRemaining - 1);
                    renderTimer();

                    if (secondsRemaining <= 5 && secondsRemaining > 0) {
                        playTone(360, 0.035);
                    }

                    if (secondsRemaining === 0) {
                        stopTimer();
                        expireRound();
                    }
                }, 1000);
            }

            function stopTimer() {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            // ---------------------------------------------
            // Sound toggle
            // ---------------------------------------------

            async function enableSound() {
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

                    if (!AudioContextClass) {
                        showToast("Sound is not supported by this browser.", "error");
                        return;
                    }

                    if (!audioContext) audioContext = new AudioContextClass();

                    if (audioContext.state === "suspended") {
                        await audioContext.resume();
                    }

                    soundEnabled = true;
                    $("soundIcon").className = "bx bx-volume-full text-lg";
                    $("soundLabel").textContent = "Sound On";

                    playTone(620, 0.08);
                } catch (error) {
                    soundEnabled = false;
                    showToast("Could not enable sound in this browser.", "error");
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
                    gain.gain.exponentialRampToValueAtTime(0.04, audioContext.currentTime + 0.015);
                    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

                    oscillator.connect(gain);
                    gain.connect(audioContext.destination);

                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + duration);
                } catch (error) {
                    // Sound is optional; gameplay continues without it.
                }
            }

            $("soundButton").addEventListener("click", async () => {
                if (soundEnabled) {
                    soundEnabled = false;
                    $("soundIcon").className = "bx bx-volume-mute text-lg";
                    $("soundLabel").textContent = "Sound Off";
                } else {
                    await enableSound();
                }
            });

            // ---------------------------------------------
            // Pause and resume
            // ---------------------------------------------

            function updatePauseButton() {
                const canPause = !roundLocked && !resolving;
                pauseButton.disabled = !canPause;

                if (paused) {
                    $("pauseIcon").className = "bx bx-play-circle text-lg";
                    $("pauseLabel").textContent = "Resume Game";
                    $("timerStatus").textContent = "Game paused";
                    $("roundStatusText").textContent = "Paused";
                } else {
                    $("pauseIcon").className = "bx bx-pause-circle text-lg";
                    $("pauseLabel").textContent = "Pause Game";

                    if (!roundLocked && !resolving) {
                        $("timerStatus").textContent = "Make your prediction before time runs out";
                        $("roundStatusText").textContent = "Ready for your prediction";
                    }
                }
            }

            pauseButton.addEventListener("click", () => {
                if (roundLocked || resolving) return;

                paused = !paused;

                if (paused) {
                    stopTimer();
                    $("predictionMessage").textContent = "Game paused. Resume to make your prediction.";
                    showToast("Practice round paused.");
                } else {
                    $("predictionMessage").textContent = "Select Higher or Lower to reveal the next number.";
                    startTimer();
                    showToast("Practice round resumed.", "success");
                }

                updatePauseButton();
                updatePredictionAvailability();
            });

            // ---------------------------------------------
            // Result panel
            // ---------------------------------------------

            function resetResultPanel() {
                numberOrb.classList.remove("higher-result", "lower-result", "same-result", "revealing");

                $("resultBadge").textContent = "Waiting";
                $("resultBadge").className =
                    "rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300";

                $("previousResult").textContent = "—";
                $("nextResult").textContent = "—";
                $("resultDirectionIcon").className = "bx bx-question-mark text-2xl";
                $("resultTitle").textContent = "Your result awaits";
                $("resultDescription").textContent = "Choose Higher or Lower to reveal the next number.";
                $("resultPrediction").textContent = "—";
                $("resultAmount").textContent = formatNaira(selectedAmount);

                $("predictionMessage").textContent = "Select Higher or Lower to reveal the next number.";
                $("numberCaption").textContent = "Make your prediction below";
            }

            function lockRound(status) {
                if (roundLocked) return false;

                roundLocked = true;
                stopTimer();

                if (status) $("roundStatusText").textContent = status;

                updatePredictionAvailability();
                updateAmountButtons();
                updatePauseButton();

                nextRoundButton.disabled = true;
                return true;
            }

            // ---------------------------------------------
            // Make prediction and reveal result
            // ---------------------------------------------

            function makePrediction(prediction) {
                if (roundLocked || paused || resolving) return;

                if (prediction === "higher" && currentNumber === MAX_NUMBER) {
                    showToast("Higher is unavailable when the current number is 100.", "error");
                    return;
                }

                if (prediction === "lower" && currentNumber === MIN_NUMBER) {
                    showToast("Lower is unavailable when the current number is 1.", "error");
                    return;
                }

                const amount = Number($("customAmount").value);

                if (!isValidAmount(amount)) {
                    showToast("Please enter a valid practice amount.", "error");
                    return;
                }

                selectedAmount = amount;
                selectedPrediction = prediction;

                if (!lockRound("Revealing the next number...")) return;

                resolving = true;

                $("predictionMessage").textContent =
                    `Prediction submitted: ${prediction.toUpperCase()}. Revealing the next number...`;

                $("numberCaption").textContent = "Revealing next number...";
                $("resultBadge").textContent = "Revealing";
                $("resultTitle").textContent = "Let's see what comes next";
                $("resultDescription").textContent = "Your demo result is being generated locally.";
                $("resultPrediction").textContent = prediction.toUpperCase();
                $("resultAmount").textContent = formatNaira(selectedAmount);

                $("previousResult").textContent = String(currentNumber);
                $("nextResult").textContent = "…";

                nextRoundButton.disabled = true;

                updatePredictionAvailability();
                updateAmountButtons();
                updatePauseButton();

                numberOrb.classList.remove("higher-result", "lower-result", "same-result");
                numberOrb.classList.add("revealing");

                playTone(460, 0.06);

                clearInterval(revealInterval);
                clearTimeout(revealTimeout);

                revealInterval = setInterval(() => {
                    currentNumberElement.textContent = randomNumber();
                    playTone(300 + Math.floor(Math.random() * 180), 0.025);
                }, 90);

                revealTimeout = setTimeout(() => {
                    clearInterval(revealInterval);
                    revealInterval = null;
                    revealTimeout = null;

                    const previousNumber = Number($("previousResult").textContent);
                    const newNumber = randomNumber();

                    resolveResult(previousNumber, newNumber, prediction);
                }, 1400);
            }

            function resolveResult(previousNumber, newNumber, prediction) {
                if (!resolving) return;

                resolving = false;

                const direction = newNumber > previousNumber
                    ? "higher"
                    : newNumber < previousNumber
                        ? "lower"
                        : "same";

                let status;

                if (direction === "same") {
                    status = "same";
                    stats.same += 1;
                } else if (prediction === direction) {
                    status = "correct";
                    stats.correct += 1;
                } else {
                    status = "incorrect";
                    stats.incorrect += 1;
                }

                stats.completed += 1;

                // Update the current number for the next round's starting point.
                currentNumber = newNumber;
                currentNumberElement.textContent = newNumber;

                numberOrb.classList.remove("revealing", "higher-result", "lower-result", "same-result");

                if (direction === "higher") {
                    numberOrb.classList.add("higher-result");
                } else if (direction === "lower") {
                    numberOrb.classList.add("lower-result");
                } else {
                    numberOrb.classList.add("same-result");
                }

                $("previousResult").textContent = previousNumber;
                $("nextResult").textContent = newNumber;

                if (direction === "higher") {
                    $("resultDirectionIcon").className = "bx bx-trending-up text-2xl text-emerald-300";
                } else if (direction === "lower") {
                    $("resultDirectionIcon").className = "bx bx-trending-down text-2xl text-rose-300";
                } else {
                    $("resultDirectionIcon").className = "bx bx-equal text-2xl text-amber-300";
                }

                const resultTitle = $("resultTitle");
                const resultDescription = $("resultDescription");
                const resultBadge = $("resultBadge");

                if (direction === "same") {
                    resultTitle.textContent = "SAME NUMBER";
                    resultDescription.textContent =
                        `Both numbers were ${newNumber}. Equal numbers are neither higher nor lower, so this round is recorded separately.`;
                    resultBadge.textContent = "Same Number";
                    resultBadge.className =
                        "rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300";

                    $("predictionMessage").textContent =
                        `The number stayed at ${newNumber}. This is recorded as a same-number result.`;

                    playTone(490, 0.12);
                } else if (status === "correct") {
                    resultTitle.textContent = "GREAT PREDICTION!";
                    resultDescription.textContent =
                        `The number went ${direction}: from ${previousNumber} to ${newNumber}. Your prediction matched the result.`;
                    resultBadge.textContent = "Correct";
                    resultBadge.className =
                        "rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300";

                    $("predictionMessage").textContent =
                        `Correct demo prediction! The number went ${direction}.`;

                    playTone(760, 0.15);
                } else {
                    resultTitle.textContent = "NOT THIS TIME";
                    resultDescription.textContent =
                        `The number went ${direction}: from ${previousNumber} to ${newNumber}. Your prediction was ${prediction}.`;
                    resultBadge.textContent = "Incorrect";
                    resultBadge.className =
                        "rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-300";

                    $("predictionMessage").textContent =
                        `The number went ${direction}, not ${prediction}.`;

                    playTone(240, 0.12);
                }

                $("roundStatusText").textContent = "Round completed";
                $("timerStatus").textContent = "Round complete";
                $("numberCaption").textContent =
                    direction === "same" ? "The number stayed the same" : `The number went ${direction}`;

                $("nextRoundHint").textContent = "Your round is complete. Start the next round when ready.";

                addHistory({
                    round,
                    previous: previousNumber,
                    next: newNumber,
                    prediction,
                    direction,
                    status
                });

                updateStats();
                updatePauseButton();
                updatePredictionAvailability();
                updateAmountButtons();

                nextRoundButton.disabled = false;

                showToast(
                    status === "correct"
                        ? "Correct prediction recorded!"
                        : status === "same"
                            ? "Same-number result recorded."
                            : "Demo prediction completed."
                    ,
                    status === "correct" ? "success" : ""
                );
            }

            higherButton.addEventListener("click", () => makePrediction("higher"));
            lowerButton.addEventListener("click", () => makePrediction("lower"));

            // ---------------------------------------------
            // Expired rounds
            // ---------------------------------------------

            function expireRound() {
                if (roundLocked || resolving) return;

                if (!lockRound("Round expired")) return;

                $("timerStatus").textContent = "Time is up";
                $("roundStatusText").textContent = "Round expired";
                $("numberCaption").textContent = "Round expired";

                $("resultBadge").textContent = "Expired";
                $("resultBadge").className =
                    "rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300";

                $("previousResult").textContent = String(currentNumber);
                $("nextResult").textContent = "—";
                $("resultDirectionIcon").className = "bx bx-time-five text-2xl text-amber-300";
                $("resultTitle").textContent = "ROUND EXPIRED";
                $("resultDescription").textContent =
                    "Time ran out before you made a prediction. No new number was drawn for this round.";
                $("resultPrediction").textContent = "No prediction";
                $("predictionMessage").textContent = "This round expired without a prediction.";

                $("nextRoundHint").textContent = "This round has expired. Start another when ready.";

                stats.expired += 1;

                addHistory({
                    round,
                    previous: currentNumber,
                    next: null,
                    prediction: null,
                    direction: null,
                    status: "expired"
                });

                updateStats();
                updatePredictionAvailability();
                updateAmountButtons();
                updatePauseButton();

                nextRoundButton.disabled = false;

                showToast("Round expired. No draw was made.");
            }

            // ---------------------------------------------
            // Next round
            // ---------------------------------------------

            function nextRound() {
                if (!roundLocked || resolving) return;

                clearInterval(revealInterval);
                clearTimeout(revealTimeout);
                stopTimer();

                revealInterval = null;
                revealTimeout = null;

                round += 1;
                secondsRemaining = ROUND_SECONDS;
                selectedPrediction = null;
                roundLocked = false;
                resolving = false;
                paused = false;

                // The last revealed number becomes the next round's starting number.
                // Expired rounds keep their existing number.
                renderCurrentNumber();
                resetResultPanel();
                renderTimer();
                updateAmountButtons();
                updatePauseButton();

                $("roundStatusText").textContent = "Ready for your prediction";
                $("timerStatus").textContent = "Make your prediction before time runs out";
                $("nextRoundHint").textContent = "Complete or expire the current round to continue.";
                $("predictionMessage").textContent = "Select Higher or Lower to reveal the next number.";
                $("numberCaption").textContent = "Make your prediction below";

                nextRoundButton.disabled = true;

                updatePredictionAvailability();
                startTimer();

                showToast(`Round #${round} is ready.`, "success");

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
                const list = $("historyList");

                $("historyCount").textContent =
                    `${history.length} round${history.length === 1 ? "" : "s"} recorded`;

                if (history.length === 0) {
                    list.innerHTML = `
            <div class="py-10 text-center">
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[.04] text-slate-500">
                <i class="bx bx-history text-2xl"></i>
              </div>
              <p class="mt-3 text-sm font-semibold text-slate-300">No rounds yet</p>
              <p class="mt-1 text-xs text-slate-500">Your demo results will appear here.</p>
            </div>
          `;
                    return;
                }

                list.innerHTML = history.map((entry) => {
                    const numberClass = entry.status === "correct"
                        ? "history-number higher"
                        : entry.status === "incorrect"
                            ? "history-number lower"
                            : entry.status === "same"
                                ? "history-number same"
                                : "history-number expired";

                    const statusClass = entry.status === "correct"
                        ? "history-status correct"
                        : entry.status === "incorrect"
                            ? "history-status incorrect"
                            : entry.status === "same"
                                ? "history-status same"
                                : "history-status expired";

                    const statusText = entry.status === "correct"
                        ? "CORRECT"
                        : entry.status === "incorrect"
                            ? "INCORRECT"
                            : entry.status === "same"
                                ? "SAME"
                                : "EXPIRED";

                    const predictionText = entry.prediction
                        ? entry.prediction.toUpperCase()
                        : "No prediction";

                    const nextNumber = entry.next === null ? "—" : String(entry.next);

                    return `
            <div class="history-row">
              <div class="min-w-0">
                <p class="history-round text-xs font-bold text-slate-200">Round #${entry.round}</p>
                <p class="history-subtitle mt-1 truncate text-[10px] text-slate-500">${predictionText}</p>
              </div>
              <div class="flex justify-center">
                <span class="history-number">${entry.previous}</span>
              </div>
              <div class="flex justify-center">
                <span class="${numberClass}">${nextNumber}</span>
              </div>
              <div class="flex justify-center">
                <span class="${statusClass}">${statusText}</span>
              </div>
            </div>
          `;
                }).join("");
            }

            // ---------------------------------------------
            // Statistics
            // ---------------------------------------------

            function updateStats() {
                $("statCompleted").textContent = stats.completed;
                $("statCorrect").textContent = stats.correct;
                $("statIncorrect").textContent = stats.incorrect;
                $("statSame").textContent = stats.same;
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

                if (type) toast.classList.add(type);

                void toast.offsetWidth;
                toast.classList.add("show");

                toastTimeout = setTimeout(() => {
                    toast.classList.remove("show");
                }, 2800);
            }

            // ---------------------------------------------
            // Mobile navigation
            // ---------------------------------------------

            const mobileMenuButton = $("mobileMenuButton");
            const mobileMenu = $("mobileMenu");
            const mobileMenuIcon = $("mobileMenuIcon");

            function closeMobileMenu() {
                mobileMenu.classList.remove("open");
                mobileMenuButton.setAttribute("aria-expanded", "false");
                mobileMenuButton.setAttribute("aria-label", "Open navigation menu");
                mobileMenuIcon.className = "bx bx-menu text-2xl";
            }

            mobileMenuButton.addEventListener("click", () => {
                const open = mobileMenu.classList.toggle("open");

                mobileMenuButton.setAttribute("aria-expanded", String(open));
                mobileMenuButton.setAttribute(
                    "aria-label",
                    open ? "Close navigation menu" : "Open navigation menu"
                );

                mobileMenuIcon.className = open
                    ? "bx bx-x text-2xl"
                    : "bx bx-menu text-2xl";
            });

            mobileMenu.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", closeMobileMenu);
            });

            window.addEventListener("resize", () => {
                if (window.innerWidth >= 768) closeMobileMenu();
            });

            // ---------------------------------------------
            // Initialise the game
            // ---------------------------------------------

            $("currentYear").textContent = new Date().getFullYear();

            renderCurrentNumber();
            resetResultPanel();
            renderTimer();
            updateAmountButtons();
            updateStats();
            renderHistory();
            updatePredictionAvailability();
            updatePauseButton();

            startTimer();

            // Stop active timers and animations when leaving the page.
            window.addEventListener("pagehide", () => {
                stopTimer();
                clearInterval(revealInterval);
                clearTimeout(revealTimeout);
                clearTimeout(toastTimeout);
            });
        });
