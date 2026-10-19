
        (() => {
            "use strict";

            const STARTING_DEMO_CREDIT = 20000;
            const MIN_AMOUNT = 100;
            const MAX_AMOUNT = 2000;
            const AMOUNT_STEP = 100;
            const ROUND_SECONDS = 20;
            const HISTORY_LIMIT = 8;
            const RESULT_DISPLAY_MS = 4000;

            let demoCredit = STARTING_DEMO_CREDIT;
            let selectedNumber = null;
            let selectedAmount = 100;
            let roundNumber = 1001;
            let secondsLeft = ROUND_SECONDS;
            let roundLocked = false;
            let roundSubmitted = false;
            let history = [];
            let nextRoundTimeout = null;
            let toastTimeout = null;

            const $ = (id) => document.getElementById(id);
            const numberGrid = $("numberGrid");
            const timerElement = $("timer");
            const customAmount = $("customAmount");
            const playButton = $("playButton");
            const amountButtons = [...document.querySelectorAll(".amount-btn")];

            const formatNaira = (amount) =>
                "₦" + Number(amount).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });

            function showToast(message) {
                const toast = $("toast");
                toast.textContent = message;
                toast.classList.add("show");

                clearTimeout(toastTimeout);
                toastTimeout = setTimeout(() => {
                    toast.classList.remove("show");
                }, 2700);
            }

            function renderBalance() {
                $("headerBalance").textContent = formatNaira(demoCredit);
                $("mainBalance").textContent = formatNaira(demoCredit);
            }

            function createNumberButtons() {
                numberGrid.innerHTML = "";

                for (let number = 0; number <= 9; number++) {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "number-option";
                    button.dataset.number = String(number);
                    button.setAttribute("aria-label", "Select number " + number);
                    button.setAttribute("aria-pressed", "false");

                    button.innerHTML = `
            <span class="number-value">${number}</span>
            <span class="number-caption">NUMBER</span>
            <i class="bx bx-check-circle selected-check" aria-hidden="true"></i>
          `;

                    button.addEventListener("click", () => {
                        selectNumber(number);
                    });

                    numberGrid.appendChild(button);
                }
            }

            function selectNumber(number) {
                if (roundLocked) {
                    showToast("This round is locked. Wait for the next practice round.");
                    return;
                }

                selectedNumber = number;

                [...numberGrid.querySelectorAll(".number-option")].forEach((button) => {
                    const selected = Number(button.dataset.number) === number;
                    button.classList.toggle("selected", selected);
                    button.setAttribute("aria-pressed", String(selected));
                });

                $("selectedNumber").textContent = String(number);
            }

            function setAmount(amount) {
                if (roundLocked) return;

                selectedAmount = Number(amount);
                customAmount.value = String(selectedAmount);

                amountButtons.forEach((button) => {
                    button.classList.toggle(
                        "active",
                        Number(button.dataset.amount) === selectedAmount
                    );
                });
            }

            function validateAmount() {
                const amount = Number(customAmount.value);

                if (
                    !Number.isFinite(amount) ||
                    !Number.isInteger(amount) ||
                    amount < MIN_AMOUNT ||
                    amount > MAX_AMOUNT ||
                    amount % AMOUNT_STEP !== 0
                ) {
                    showToast("Enter an amount from ₦100 to ₦2,000 in ₦100 increments.");
                    customAmount.focus();
                    return null;
                }

                selectedAmount = amount;
                return amount;
            }

            function renderTimer() {
                const seconds = Math.max(0, secondsLeft);

                timerElement.textContent = "00:" + String(seconds).padStart(2, "0");
                timerElement.classList.toggle("warning", seconds <= 5);

                $("timerProgress").style.width =
                    ((seconds / ROUND_SECONDS) * 100) + "%";

                $("roundNumber").textContent = "ROUND " + roundNumber;

                if (roundLocked) {
                    $("timerCaption").textContent = "Selection submitted — preparing result";
                } else if (seconds <= 5) {
                    $("timerCaption").textContent = "Round closing soon";
                } else {
                    $("timerCaption").textContent = "Select one number before the round ends";
                }
            }

            function setRoundLocked(locked) {
                roundLocked = locked;

                [...numberGrid.querySelectorAll(".number-option")].forEach((button) => {
                    button.disabled = locked;
                });

                amountButtons.forEach((button) => {
                    button.disabled = locked;
                });

                customAmount.disabled = locked;
                playButton.disabled = locked;

                playButton.innerHTML = locked
                    ? '<i class="bx bx-time-five" style="font-size:17px;vertical-align:middle;margin-right:5px;"></i> Round in Progress'
                    : '<i class="bx bx-play-circle" style="font-size:17px;vertical-align:middle;margin-right:5px;"></i> Play Practice Round';

                renderTimer();
            }

            function renderHistory() {
                const historyList = $("historyList");

                if (history.length === 0) {
                    historyList.innerHTML = `
            <div class="empty-state">
              <i class="bx bx-bar-chart-alt-2"></i>
              No practice rounds yet.<br>
              Your simulated results will appear here.
            </div>
          `;
                    return;
                }

                historyList.innerHTML = history.map((item) => `
          <div class="history-row">
            <div class="history-icon">${item.result}</div>

            <div>
              <div class="history-title">Round ${item.round}</div>
              <div class="history-subtitle">
                Selected ${item.choice} · Result ${item.result}<br>
                Practice amount: ${formatNaira(item.amount)}
              </div>
            </div>

            <div class="history-status" style="color:${item.matched ? 'var(--green)' : 'var(--red)'}">
              ${item.matched ? "MATCH" : "NO MATCH"}
            </div>
          </div>
        `).join("");
            }

            function showResult(result) {
                const matched = result === selectedNumber;

                $("yourResult").textContent = String(selectedNumber);
                $("generatedResult").textContent = String(result);

                $("yourResult").classList.toggle("match", matched);
                $("generatedResult").classList.toggle("match", matched);

                const status = $("resultStatus");
                status.textContent = matched ? "MATCH" : "NO MATCH";
                status.classList.toggle("match", matched);

                $("resultMessage").textContent =
                    "Practice amount: " + formatNaira(selectedAmount) + ". " +
                    (matched
                        ? "Your selected number matches the generated result."
                        : "Your selected number does not match the generated result.") +
                    " This is a simulated result; no winnings or losses are applied.";

                $("resultBox").classList.add("show");

                history.unshift({
                    round: roundNumber,
                    choice: selectedNumber,
                    result,
                    amount: selectedAmount,
                    matched
                });

                history = history.slice(0, HISTORY_LIMIT);
                renderHistory();

                showToast(matched
                    ? "Your number matched the practice result!"
                    : "Practice round complete. View your result.");

                // The demo balance intentionally remains unchanged.
                // No real wallet, payment, wagering, or payout operation occurs.
                nextRoundTimeout = setTimeout(resetRound, RESULT_DISPLAY_MS);
            }

            function submitPracticeRound() {
                if (roundLocked || roundSubmitted) return;

                if (selectedNumber === null) {
                    showToast("Please select a number from 0 to 9.");
                    return;
                }

                const amount = validateAmount();
                if (amount === null) return;

                selectedAmount = amount;
                roundSubmitted = true;
                setRoundLocked(true);

                // This generated number is only a browser-based demo result.
                const result = Math.floor(Math.random() * 10);

                nextRoundTimeout = setTimeout(() => {
                    showResult(result);
                }, 1300);
            }

            function resetRound() {
                clearTimeout(nextRoundTimeout);
                nextRoundTimeout = null;

                roundNumber += 1;
                secondsLeft = ROUND_SECONDS;
                selectedNumber = null;
                roundSubmitted = false;

                $("selectedNumber").textContent = "None selected";
                $("resultBox").classList.remove("show");

                [...numberGrid.querySelectorAll(".number-option")].forEach((button) => {
                    button.classList.remove("selected");
                    button.setAttribute("aria-pressed", "false");
                });

                setRoundLocked(false);
                renderTimer();
            }

            amountButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    setAmount(Number(button.dataset.amount));
                });
            });

            customAmount.addEventListener("input", () => {
                if (roundLocked) return;

                const value = Number(customAmount.value);

                amountButtons.forEach((button) => {
                    button.classList.toggle(
                        "active",
                        customAmount.value !== "" &&
                        Number(button.dataset.amount) === value
                    );
                });

                selectedAmount = value;
            });

            playButton.addEventListener("click", submitPracticeRound);

            // One countdown interval for the current page.
            setInterval(() => {
                if (roundLocked) return;

                if (secondsLeft > 0) {
                    secondsLeft -= 1;
                    renderTimer();
                }

                if (secondsLeft === 0 && !roundSubmitted) {
                    // Do not generate a result for an unsubmitted round.
                    setRoundLocked(true);
                    $("timerCaption").textContent = "Time expired — starting a new round";

                    nextRoundTimeout = setTimeout(() => {
                        showToast("Time expired. A new practice round has started.");
                        resetRound();
                    }, 1200);
                }
            }, 1000);

            // Mobile menu helper.
            // The dashboard link remains the main navigation destination.
            const menuButton = $("menuButton");

            menuButton.addEventListener("click", () => {
                const expanded = menuButton.getAttribute("aria-expanded") === "true";

                menuButton.setAttribute("aria-expanded", String(!expanded));
                menuButton.innerHTML = expanded
                    ? '<i class="bx bx-menu"></i>'
                    : '<i class="bx bx-x"></i>';

                showToast(expanded
                    ? "Navigation closed."
                    : "Use Back to Dashboard to return to your dashboard.");
            });

            createNumberButtons();
            setAmount(100);
            renderBalance();
            renderTimer();
            renderHistory();
        })();