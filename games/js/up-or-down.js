
        (() => {
            "use strict";

            // ------------------------------
            // Game configuration
            // ------------------------------
            const ROUND_SECONDS = 20;
            const MIN_AMOUNT = 100;
            const MAX_AMOUNT = 2000;
            const AMOUNT_STEP = 100;
            const INITIAL_ROUND = 2001;
            const INITIAL_BALANCE = 20000;

            const moneyFormatter = new Intl.NumberFormat("en-NG", {
                maximumFractionDigits: 0
            });

            const $ = (id) => document.getElementById(id);

            // ------------------------------
            // Game state
            // ------------------------------
            let roundNumber = INITIAL_ROUND;
            let currentNumber = randomNumber();
            let previousNumber = null;
            let selectedAmountValue = 100;
            let selectedPrediction = null;
            let secondsLeft = ROUND_SECONDS;
            let roundLocked = false;
            let paused = false;
            let soundEnabled = false;
            let history = [];
            let completedRounds = 0;
            let correctPredictions = 0;
            let incorrectPredictions = 0;
            let timerInterval = null;
            let toastTimeout = null;
            let audioContext = null;

            // ------------------------------
            // Elements
            // ------------------------------
            const currentNumberEl = $("currentNumber");
            const previousNumberEl = $("previousNumber");
            const roundNumberEl = $("roundNumber");
            const timerTextEl = $("timerText");
            const timerFillEl = $("timerFill");
            const timerStatusEl = $("timerStatus");
            const timerDotEl = $("timerDot");
            const upButton = $("upButton");
            const downButton = $("downButton");
            const pauseButton = $("pauseButton");
            const soundButton = $("soundButton");
            const soundIcon = $("soundIcon");
            const nextRoundButton = $("nextRoundButton");
            const predictionBadge = $("predictionBadge");
            const customAmountInput = $("customAmount");
            const amountError = $("amountError");
            const selectedAmountEl = $("selectedAmount");
            const resultPanel = $("resultPanel");
            const historyList = $("historyList");

            $("year").textContent = new Date().getFullYear();

            // ------------------------------
            // Utilities
            // ------------------------------
            function randomNumber() {
                return Math.floor(Math.random() * 100) + 1;
            }

            function formatNaira(amount) {
                return "₦" + moneyFormatter.format(amount);
            }

            function showToast(message) {
                const toast = $("toast");
                toast.textContent = message;
                toast.classList.add("show");

                clearTimeout(toastTimeout);
                toastTimeout = setTimeout(() => {
                    toast.classList.remove("show");
                }, 2600);
            }

            function playTone(frequency = 520, duration = 0.09) {
                if (!soundEnabled) return;

                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContextClass) return;

                    if (!audioContext) audioContext = new AudioContextClass();

                    if (audioContext.state === "suspended") {
                        audioContext.resume();
                    }

                    const oscillator = audioContext.createOscillator();
                    const gain = audioContext.createGain();

                    oscillator.type = "sine";
                    oscillator.frequency.value = frequency;
                    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
                    gain.gain.exponentialRampToValueAtTime(
                        0.001,
                        audioContext.currentTime + duration
                    );

                    oscillator.connect(gain);
                    gain.connect(audioContext.destination);

                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + duration);
                } catch (error) {
                    // Audio is optional; gameplay remains functional if unavailable.
                }
            }

            function animateNumber() {
                currentNumberEl.classList.remove("number-change");
                void currentNumberEl.offsetWidth;
                currentNumberEl.classList.add("number-change");
            }

            // ------------------------------
            // Amount selection and validation
            // ------------------------------
            function validateAmount(showMessage = true) {
                const rawValue = customAmountInput.value.trim();
                const amount = Number(rawValue);

                let error = "";

                if (rawValue === "" || !Number.isFinite(amount)) {
                    error = "Enter a valid amount.";
                } else if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
                    error = "Amount must be between ₦100 and ₦2,000.";
                } else if (amount % AMOUNT_STEP !== 0) {
                    error = "Use increments of ₦100.";
                }

                if (error) {
                    amountError.textContent = error;
                    amountError.classList.remove("hidden");
                    customAmountInput.setAttribute("aria-invalid", "true");

                    if (showMessage) showToast(error);
                    return false;
                }

                amountError.textContent = "";
                amountError.classList.add("hidden");
                customAmountInput.removeAttribute("aria-invalid");

                selectedAmountValue = amount;
                selectedAmountEl.textContent = formatNaira(amount);

                document.querySelectorAll("[data-amount]").forEach((button) => {
                    const active = Number(button.dataset.amount) === amount;
                    button.classList.toggle("active", active);
                    button.setAttribute("aria-pressed", String(active));
                });

                return true;
            }

            document.querySelectorAll("[data-amount]").forEach((button) => {
                button.addEventListener("click", () => {
                    customAmountInput.value = button.dataset.amount;
                    validateAmount(false);
                    playTone(480, 0.06);
                });
            });

            customAmountInput.addEventListener("input", () => {
                validateAmount(false);
            });

            customAmountInput.addEventListener("blur", () => {
                if (customAmountInput.value.trim() !== "") {
                    validateAmount(false);
                }
            });

            // ------------------------------
            // Timer and round state
            // ------------------------------
            function updateTimerDisplay() {
                timerTextEl.textContent = "00:" + String(secondsLeft).padStart(2, "0");
                timerFillEl.style.width = (secondsLeft / ROUND_SECONDS * 100) + "%";

                const urgent = secondsLeft <= 5;
                timerFillEl.classList.toggle("urgent", urgent);
                timerDotEl.classList.toggle("bg-rose-400", urgent);
                timerDotEl.classList.toggle("bg-violet-400", !urgent);

                if (roundLocked) {
                    timerStatusEl.textContent = "Round complete";
                } else if (paused) {
                    timerStatusEl.textContent = "Timer paused";
                } else if (selectedPrediction) {
                    timerStatusEl.textContent = "Prediction submitted";
                } else if (urgent) {
                    timerStatusEl.textContent = "Time is running out";
                } else {
                    timerStatusEl.textContent = "Place your prediction";
                }
            }

            function startTimer() {
                clearInterval(timerInterval);
                timerInterval = setInterval(() => {
                    if (paused || roundLocked) return;

                    secondsLeft -= 1;
                    updateTimerDisplay();

                    if (secondsLeft === 5) {
                        playTone(360, 0.06);
                    }

                    if (secondsLeft <= 0) {
                        expireRound();
                    }
                }, 1000);
            }

            function lockRound() {
                roundLocked = true;
                upButton.disabled = true;
                downButton.disabled = true;
                nextRoundButton.disabled = false;
                pauseButton.disabled = true;
                updateTimerDisplay();
            }

            function expireRound() {
                if (roundLocked) return;

                lockRound();
                secondsLeft = 0;
                updateTimerDisplay();

                if (!selectedPrediction) {
                    showResult({
                        expired: true,
                        previous: currentNumber,
                        next: null,
                        direction: null,
                        prediction: null,
                        status: "expired"
                    });

                    showToast("Round expired — no prediction was submitted.");
                } else {
                    // A submitted prediction is resolved when the timer expires.
                    resolvePrediction();
                    return;
                }

                playTone(260, 0.12);
            }

            function updatePredictionButtons() {
                upButton.disabled = roundLocked || paused;
                downButton.disabled = roundLocked || paused;
            }

            // ------------------------------
            // Prediction and result logic
            // ------------------------------
            function submitPrediction(direction) {
                if (roundLocked) {
                    showToast("This round is locked. Start the next round to continue.");
                    return;
                }

                if (paused) {
                    showToast("Resume the timer before making a prediction.");
                    return;
                }

                if (selectedPrediction) {
                    showToast("You have already submitted a prediction this round.");
                    return;
                }

                if (!validateAmount(true)) return;

                selectedPrediction = direction;
                predictionBadge.textContent = direction === "up" ? "UP selected" : "DOWN selected";
                predictionBadge.classList.remove("bg-violet-400/10", "text-violet-200");
                predictionBadge.classList.add(
                    direction === "up" ? "bg-green-400/10" : "bg-rose-400/10",
                    direction === "up" ? "text-green-200" : "text-rose-200"
                );

                timerStatusEl.textContent = "Prediction submitted";
                lockRound();

                showToast("Your " + direction.toUpperCase() + " practice prediction is submitted.");
                playTone(direction === "up" ? 620 : 430, 0.08);

                // Resolve after a short reveal pause so the choice is visible.
                setTimeout(() => {
                    resolvePrediction();
                }, 850);
            }

            function resolvePrediction() {
                if (!roundLocked || !selectedPrediction) return;

                const nextNumber = randomNumber();
                const direction =
                    nextNumber > currentNumber ? "up" :
                        nextNumber < currentNumber ? "down" : "same";

                const isCorrect = direction !== "same" && direction === selectedPrediction;

                const entry = {
                    round: roundNumber,
                    previous: currentNumber,
                    next: nextNumber,
                    direction,
                    prediction: selectedPrediction,
                    status: direction === "same" ? "same" : (isCorrect ? "correct" : "incorrect")
                };

                if (direction !== "same") {
                    completedRounds += 1;
                    if (isCorrect) {
                        correctPredictions += 1;
                    } else {
                        incorrectPredictions += 1;
                    }
                }

                history.unshift(entry);
                history = history.slice(0, 8);

                renderHistory();
                updateStats();

                previousNumber = currentNumber;
                currentNumber = nextNumber;
                currentNumberEl.textContent = currentNumber;
                previousNumberEl.textContent = previousNumber;
                animateNumber();

                showResult({
                    expired: false,
                    previous: entry.previous,
                    next: entry.next,
                    direction: entry.direction,
                    prediction: entry.prediction,
                    status: entry.status
                });

                playTone(isCorrect ? 760 : direction === "same" ? 500 : 300, 0.14);
                nextRoundButton.disabled = false;
                timerStatusEl.textContent = "Result ready — continue when you like";
            }

            function showResult(result) {
                resultPanel.classList.remove("hidden", "result-up", "result-down", "result-same");

                const icon = $("resultIcon");
                const title = $("resultTitle");
                const description = $("resultDescription");
                const resultDirection = $("resultDirection");
                const resultStatus = $("resultStatus");

                if (result.expired) {
                    resultPanel.classList.add("result-same");
                    icon.innerHTML = '<i class="bx bx-time-five"></i>';
                    title.textContent = "ROUND EXPIRED";
                    description.textContent = "No prediction was submitted before the countdown ended.";
                    $("resultPrevious").textContent = result.previous;
                    $("resultNext").textContent = "—";
                    resultDirection.textContent = "—";
                    $("resultPrediction").textContent = "None";
                    resultStatus.textContent = "NO PREDICTION";
                    resultStatus.className = "font-extrabold status-neutral";
                    return;
                }

                const directionLabel = result.direction.toUpperCase();
                const predictionLabel = result.prediction.toUpperCase();

                $("resultPrevious").textContent = result.previous;
                $("resultNext").textContent = result.next;
                resultDirection.textContent = directionLabel;
                $("resultPrediction").textContent = predictionLabel;

                if (result.direction === "up") {
                    resultPanel.classList.add("result-up");
                    icon.innerHTML = '<i class="bx bx-trending-up"></i>';
                    title.textContent = "THE NUMBER WENT UP";
                    description.textContent = result.previous + " → " + result.next + ". The new number is higher.";
                } else if (result.direction === "down") {
                    resultPanel.classList.add("result-down");
                    icon.innerHTML = '<i class="bx bx-trending-down"></i>';
                    title.textContent = "THE NUMBER WENT DOWN";
                    description.textContent = result.previous + " → " + result.next + ". The new number is lower.";
                } else {
                    resultPanel.classList.add("result-same");
                    icon.innerHTML = '<i class="bx bx-equal"></i>';
                    title.textContent = "SAME NUMBER — NO DIRECTION";
                    description.textContent = "Both numbers were " + result.previous + ". Neither UP nor DOWN occurred.";
                }

                if (result.status === "correct") {
                    resultStatus.textContent = "CORRECT PREDICTION";
                    resultStatus.className = "font-extrabold status-correct";
                } else if (result.status === "incorrect") {
                    resultStatus.textContent = "INCORRECT PREDICTION";
                    resultStatus.className = "font-extrabold status-incorrect";
                } else {
                    resultStatus.textContent = "NO DIRECTION";
                    resultStatus.className = "font-extrabold status-neutral";
                }
            }

            // ------------------------------
            // History and statistics
            // ------------------------------
            function directionMarkup(direction) {
                if (direction === "up") {
                    return '<span class="direction-tag tag-up"><i class="bx bx-up-arrow-alt"></i> UP</span>';
                }

                if (direction === "down") {
                    return '<span class="direction-tag tag-down"><i class="bx bx-down-arrow-alt"></i> DOWN</span>';
                }

                return '<span class="direction-tag tag-same"><i class="bx bx-equal"></i> SAME</span>';
            }

            function resultMarkup(status) {
                if (status === "correct") {
                    return '<span class="history-cell status-correct text-[10px] font-bold">CORRECT</span>';
                }

                if (status === "incorrect") {
                    return '<span class="history-cell status-incorrect text-[10px] font-bold">INCORRECT</span>';
                }

                if (status === "same") {
                    return '<span class="history-cell status-neutral text-[10px] font-bold">NO DIRECTION</span>';
                }

                return '<span class="history-cell text-[10px] font-bold text-slate-500">EXPIRED</span>';
            }

            function renderHistory() {
                if (history.length === 0) {
                    historyList.innerHTML = `
            <div class="py-9 text-center">
              <div class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-violet-400/[.08] text-2xl text-violet-300">
                <i class="bx bx-bar-chart-alt-2"></i>
              </div>
              <p class="text-sm font-semibold text-slate-300">No rounds completed yet</p>
              <p class="mt-1 text-xs text-slate-500">Your recent results will appear here.</p>
            </div>
          `;
                    return;
                }

                historyList.innerHTML = history.map((item) => {
                    const numberText = item.next === null
                        ? item.previous + " → —"
                        : item.previous + " → " + item.next;

                    return `
            <div class="history-row">
              <div class="history-cell text-[11px] font-semibold text-slate-300">#${item.round}</div>
              <div class="history-cell text-[10px] font-semibold text-slate-300 sm:text-xs">${numberText}</div>
              <div>${item.direction ? directionMarkup(item.direction) : '<span class="text-[10px] text-slate-500">—</span>'}</div>
              <div>${resultMarkup(item.status)}</div>
            </div>
          `;
                }).join("");
            }

            function updateStats() {
                $("completedCount").textContent = completedRounds;
                $("correctCount").textContent = correctPredictions;
                $("incorrectCount").textContent = incorrectPredictions;
            }

            // ------------------------------
            // Start a fresh round
            // ------------------------------
            function startNextRound() {
                if (!roundLocked) {
                    showToast("Finish the current round before continuing.");
                    return;
                }

                roundNumber += 1;
                previousNumber = currentNumber;
                currentNumber = randomNumber();
                selectedPrediction = null;
                secondsLeft = ROUND_SECONDS;
                roundLocked = false;
                paused = false;

                roundNumberEl.textContent = roundNumber;
                currentNumberEl.textContent = currentNumber;
                previousNumberEl.textContent = previousNumber;
                animateNumber();

                resultPanel.classList.add("hidden");
                predictionBadge.textContent = "Not selected";
                predictionBadge.className = "rounded-lg bg-violet-400/10 px-2.5 py-1.5 text-[10px] font-bold text-violet-200";

                pauseButton.disabled = false;
                pauseButton.innerHTML = '<i class="bx bx-pause text-lg"></i> Pause timer';
                nextRoundButton.disabled = true;

                updatePredictionButtons();
                updateTimerDisplay();
                startTimer();
                playTone(500, 0.06);
            }

            // ------------------------------
            // Pause and resume
            // ------------------------------
            function togglePause() {
                if (roundLocked) return;

                paused = !paused;

                if (paused) {
                    pauseButton.innerHTML = '<i class="bx bx-play text-lg"></i> Resume timer';
                    timerStatusEl.textContent = "Timer paused";
                    showToast("Timer paused.");
                } else {
                    pauseButton.innerHTML = '<i class="bx bx-pause text-lg"></i> Pause timer';
                    showToast("Timer resumed.");
                }

                updatePredictionButtons();
                updateTimerDisplay();
            }

            // ------------------------------
            // Sound control
            // ------------------------------
            function toggleSound() {
                soundEnabled = !soundEnabled;

                soundButton.setAttribute("aria-pressed", String(soundEnabled));
                soundIcon.className = soundEnabled
                    ? "bx bx-volume-full text-lg"
                    : "bx bx-volume-mute text-lg";

                soundButton.lastChild.textContent = soundEnabled ? " Sound on" : " Sound off";

                if (soundEnabled) {
                    playTone(600, 0.08);
                    showToast("Sound effects enabled.");
                } else {
                    showToast("Sound effects disabled.");
                }
            }

            // ------------------------------
            // Mobile navigation
            // ------------------------------
            const menuToggle = $("menuToggle");
            const mobileNav = $("mobileNav");

            menuToggle.addEventListener("click", () => {
                const isOpen = mobileNav.classList.toggle("open");
                menuToggle.setAttribute("aria-expanded", String(isOpen));
                menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
                menuToggle.innerHTML = isOpen
                    ? '<i class="bx bx-x text-xl"></i>'
                    : '<i class="bx bx-menu text-xl"></i>';
            });

            // ------------------------------
            // Event listeners
            // ------------------------------
            upButton.addEventListener("click", () => submitPrediction("up"));
            downButton.addEventListener("click", () => submitPrediction("down"));
            pauseButton.addEventListener("click", togglePause);
            soundButton.addEventListener("click", toggleSound);
            nextRoundButton.addEventListener("click", startNextRound);

            // ------------------------------
            // Initial render
            // ------------------------------
            $("demoBalance").textContent =
                "₦" + INITIAL_BALANCE.toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });

            currentNumberEl.textContent = currentNumber;
            roundNumberEl.textContent = roundNumber;
            previousNumberEl.textContent = "—";

            validateAmount(false);
            updateTimerDisplay();
            updatePredictionButtons();
            renderHistory();
            updateStats();
            startTimer();
        })();
