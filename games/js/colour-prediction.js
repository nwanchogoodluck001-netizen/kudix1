
        (() => {
            "use strict";

            // Frontend-only demo settings.
            // This balance is simulated and is not connected to a real wallet.
            const STARTING_DEMO_CREDIT = 20000;
            const MIN_AMOUNT = 100;
            const MAX_AMOUNT = 2000;
            const ROUND_SECONDS = 20;
            const HISTORY_LIMIT = 8;

            const colours = {
                red: { label: "RED", icon: "bx-circle" },
                green: { label: "GREEN", icon: "bx-circle" },
                violet: { label: "VIOLET", icon: "bx-circle" }
            };

            let demoCredit = STARTING_DEMO_CREDIT;
            let selectedColour = "";
            let selectedAmount = 100;
            let roundNumber = 1001;
            let secondsLeft = ROUND_SECONDS;
            let roundLocked = false;
            let roundSubmitted = false;
            let history = [];
            let toastTimeout;

            const $ = (id) => document.getElementById(id);
            const colourButtons = [...document.querySelectorAll(".colour-option")];
            const amountButtons = [...document.querySelectorAll(".amount-btn")];
            const timerElement = $("timer");
            const playButton = $("playButton");
            const customAmount = $("customAmount");

            const formatNaira = (amount) =>
                "₦" + Number(amount).toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });

            function renderBalance() {
                $("headerBalance").textContent = formatNaira(demoCredit);
                $("mainBalance").textContent = formatNaira(demoCredit);
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

            function setSelectedColour(colour) {
                if (roundLocked) {
                    showToast("This practice round has already started.");
                    return;
                }

                selectedColour = colour;

                colourButtons.forEach((button) => {
                    const isSelected = button.dataset.colour === colour;
                    button.classList.toggle("selected", isSelected);
                    button.setAttribute("aria-pressed", String(isSelected));
                });
            }

            function setAmount(amount) {
                const parsedAmount = Number(amount);

                if (!Number.isFinite(parsedAmount)) return;

                selectedAmount = parsedAmount;
                customAmount.value = String(parsedAmount);

                amountButtons.forEach((button) => {
                    button.classList.toggle(
                        "active",
                        Number(button.dataset.amount) === parsedAmount
                    );
                });
            }

            function renderTimer() {
                const seconds = Math.max(0, secondsLeft);
                timerElement.textContent =
                    "00:" + String(seconds).padStart(2, "0");

                timerElement.classList.toggle("warning", seconds <= 5);

                $("timerProgress").style.width =
                    ((seconds / ROUND_SECONDS) * 100) + "%";

                $("roundNumber").textContent = "ROUND " + roundNumber;

                if (roundLocked) {
                    $("timerCaption").textContent = "Round submitted — waiting for the result";
                } else if (seconds <= 5) {
                    $("timerCaption").textContent = "Round closing soon";
                } else {
                    $("timerCaption").textContent = "Choose a colour before the timer ends";
                }
            }

            function renderHistory() {
                const list = $("historyList");

                if (!history.length) {
                    list.innerHTML = `
            <div class="empty-state">
              <i class="bx bx-bar-chart-alt-2"></i>
              No practice rounds yet.<br>
              Your simulated results will appear here.
            </div>
          `;
                    return;
                }

                list.innerHTML = history.map((item) => {
                    const colour = colours[item.result];
                    const choice = colours[item.choice];

                    return `
            <div class="history-row">
              <div class="history-icon ${item.result}">
                <i class="bx ${colour.icon}"></i>
              </div>
              <div>
                <div class="history-title">Round ${item.round}</div>
                <div class="history-subtitle">
                  Your choice: ${choice.label} · Result: ${colour.label}
                </div>
              </div>
              <div class="history-amount" style="color:${item.result === item.choice ? 'var(--green)' : 'var(--muted)'}">
                ${item.result === item.choice ? "MATCH" : "PRACTICE"}
              </div>
            </div>
          `;
                }).join("");
            }

            function setRoundLocked(locked) {
                roundLocked = locked;

                colourButtons.forEach((button) => {
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

            function resetRound() {
                roundNumber += 1;
                secondsLeft = ROUND_SECONDS;
                selectedColour = "";
                roundSubmitted = false;

                colourButtons.forEach((button) => {
                    button.classList.remove("selected");
                    button.setAttribute("aria-pressed", "false");
                });

                $("resultBox").classList.remove("show");
                setRoundLocked(false);
                renderTimer();
            }

            function completeRound() {
                if (!roundSubmitted) return;

                const availableColours = Object.keys(colours);
                const result = availableColours[
                    Math.floor(Math.random() * availableColours.length)
                ];

                const matched = result === selectedColour;
                const resultElement = $("resultColour");

                resultElement.textContent = colours[result].label;
                resultElement.className = "result-colour " + result;

                $("resultMessage").textContent =
                    "You selected " + colours[selectedColour].label +
                    ". The simulated result is " + colours[result].label +
                    (matched
                        ? ". Your colour matched the result."
                        : ". Your colour did not match the result.") +
                    " No real money or cash payout is involved.";

                $("resultBox").classList.add("show");

                history.unshift({
                    round: roundNumber,
                    choice: selectedColour,
                    result: result,
                    amount: selectedAmount
                });

                history = history.slice(0, HISTORY_LIMIT);
                renderHistory();

                showToast(matched
                    ? "Your colour matched the practice result!"
                    : "Practice round complete. Check the result.");

                // The displayed demo credit intentionally does not change.
                // No wagering, financial payout, or real wallet operation occurs.
                setTimeout(resetRound, 4200);
            }

            function submitPracticeRound() {
                if (roundLocked || roundSubmitted) return;

                if (!selectedColour) {
                    showToast("Choose a colour first.");
                    return;
                }

                const amount = Number(customAmount.value);

                if (
                    !Number.isFinite(amount) ||
                    amount < MIN_AMOUNT ||
                    amount > MAX_AMOUNT ||
                    amount % 100 !== 0
                ) {
                    showToast("Enter an amount from ₦100 to ₦2,000 in ₦100 increments.");
                    customAmount.focus();
                    return;
                }

                selectedAmount = amount;
                roundSubmitted = true;
                setRoundLocked(true);

                $("timerCaption").textContent = "Practice selection submitted";

                // Demo-only round. The amount is recorded for display purposes only.
                setTimeout(completeRound, 1400);
            }

            colourButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    setSelectedColour(button.dataset.colour);
                });
            });

            amountButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    if (roundLocked) return;
                    setAmount(Number(button.dataset.amount));
                });
            });

            customAmount.addEventListener("input", () => {
                if (roundLocked) return;

                const value = Number(customAmount.value);

                amountButtons.forEach((button) => {
                    button.classList.toggle(
                        "active",
                        Number(button.dataset.amount) === value
                    );
                });

                if (Number.isFinite(value)) selectedAmount = value;
            });

            playButton.addEventListener("click", submitPracticeRound);

            // Countdown for the practice interface.
            setInterval(() => {
                if (roundLocked) return;

                secondsLeft -= 1;

                if (secondsLeft <= 0) {
                    secondsLeft = 0;
                    renderTimer();

                    if (!roundSubmitted) {
                        showToast("Round timer ended. A new practice round is starting.");
                        setTimeout(resetRound, 900);
                    }
                    return;
                }

                renderTimer();
            }, 1000);

            // Mobile navigation button: a small menu toggle for the prototype.
            const menuButton = $("menuButton");

            menuButton.addEventListener("click", () => {
                const expanded = menuButton.getAttribute("aria-expanded") === "true";
                menuButton.setAttribute("aria-expanded", String(!expanded));
                menuButton.innerHTML = expanded
                    ? '<i class="bx bx-menu"></i>'
                    : '<i class="bx bx-x"></i>';

                showToast(expanded
                    ? "Menu closed. Use Back to Dashboard to return."
                    : "Use Back to Dashboard to return to your dashboard.");
            });

            setAmount(100);
            renderBalance();
            renderTimer();
            renderHistory();
        })();
