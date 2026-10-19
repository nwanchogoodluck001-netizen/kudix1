
        (() => {
            "use strict";

            const STARTING_DEMO_CREDIT = 20000;
            const MIN_AMOUNT = 100;
            const MAX_AMOUNT = 2000;
            const AMOUNT_STEP = 100;
            const ROUND_SECONDS = 20;
            const HISTORY_LIMIT = 8;
            const FLIP_DURATION = 1450;
            const RESULT_DISPLAY_MS = 4200;

            let demoCredit = STARTING_DEMO_CREDIT;
            let selectedSide = null;
            let selectedAmount = 100;
            let roundNumber = 1001;
            let secondsLeft = ROUND_SECONDS;
            let roundLocked = false;
            let roundSubmitted = false;
            let history = [];
            let roundTimeout = null;
            let toastTimeout = null;

            const $ = (id) => document.getElementById(id);
            const coin = $("coin");
            const coinStatus = $("coinStatus");
            const flipButton = $("flipButton");
            const customAmount = $("customAmount");
            const sideButtons = [...document.querySelectorAll(".side-option")];
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
                }, 2600);
            }

            function renderBalance() {
                $("headerBalance").textContent = formatNaira(demoCredit);
                $("mainBalance").textContent = formatNaira(demoCredit);
            }

            function setSelectedSide(side) {
                if (roundLocked) {
                    showToast("This round is locked. Wait for the next practice round.");
                    return;
                }

                selectedSide = side;

                sideButtons.forEach((button) => {
                    const isSelected = button.dataset.side === side;
                    button.classList.toggle("selected", isSelected);
                    button.setAttribute("aria-pressed", String(isSelected));
                });

                $("selectedSide").textContent = side.toUpperCase();
                coinStatus.innerHTML =
                    "<strong>" + side.toUpperCase() + " selected</strong><br>Ready when you are";
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
                    customAmount.value.trim() === "" ||
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

                $("timer").textContent = "00:" + String(seconds).padStart(2, "0");
                $("timer").classList.toggle("warning", seconds <= 5);

                $("timerProgress").style.width =
                    ((seconds / ROUND_SECONDS) * 100) + "%";

                $("roundNumber").textContent = "ROUND " + roundNumber;

                if (roundLocked) {
                    $("timerCaption").textContent = "Round submitted — waiting for result";
                } else if (seconds <= 5) {
                    $("timerCaption").textContent = "Round closing soon";
                } else {
                    $("timerCaption").textContent = "Choose Heads or Tails before the timer ends";
                }
            }

            function setRoundLocked(locked) {
                roundLocked = locked;

                sideButtons.forEach((button) => {
                    button.disabled = locked;
                });

                amountButtons.forEach((button) => {
                    button.disabled = locked;
                });

                customAmount.disabled = locked;
                flipButton.disabled = locked;

                flipButton.innerHTML = locked
                    ? '<i class="bx bx-loader-alt" style="font-size:18px;vertical-align:middle;margin-right:5px;"></i> Round in Progress'
                    : '<i class="bx bx-coin" style="font-size:18px;vertical-align:middle;margin-right:5px;"></i> Flip Coin';

                renderTimer();
            }

            function renderHistory() {
                const historyList = $("historyList");

                if (!history.length) {
                    historyList.innerHTML = `
            <div class="empty-state">
              <i class="bx bx-history"></i>
              No practice rounds yet.<br>
              Your coin-flip results will appear here.
            </div>
          `;
                    return;
                }

                historyList.innerHTML = history.map((item) => `
          <div class="history-row">
            <div class="history-icon">
              <i class="bx bx-coin"></i>
            </div>

            <div>
              <div class="history-title">Round ${item.round}</div>
              <div class="history-subtitle">
                Choice: ${item.choice.toUpperCase()} · Result: ${item.result.toUpperCase()}<br>
                Practice amount: ${formatNaira(item.amount)}
              </div>
            </div>

            <div class="history-status" style="color:${item.matched ? 'var(--green)' : 'var(--red)'}">
              ${item.matched ? "MATCH" : "NO MATCH"}
            </div>
          </div>
        `).join("");
            }

            function clearCoinAnimation() {
                coin.classList.remove("flip-heads", "flip-tails");
                coin.style.transform = "rotateY(0deg)";
            }

            function showResult(result) {
                const matched = result === selectedSide;

                $("yourChoiceResult").textContent = selectedSide.toUpperCase();
                $("coinResult").textContent = result.toUpperCase();

                const status = $("resultStatus");
                status.textContent = matched ? "MATCH" : "NO MATCH";
                status.classList.toggle("match", matched);

                $("resultMessage").textContent =
                    "Practice amount: " + formatNaira(selectedAmount) + ". " +
                    (matched
                        ? "Your chosen side matches the simulated coin result."
                        : "Your chosen side does not match the simulated coin result.") +
                    " No winnings or losses are applied to the demo credit.";

                $("resultBox").classList.add("show");

                history.unshift({
                    round: roundNumber,
                    choice: selectedSide,
                    result,
                    amount: selectedAmount,
                    matched
                });

                history = history.slice(0, HISTORY_LIMIT);
                renderHistory();

                coinStatus.innerHTML =
                    "<strong>Result: " + result.toUpperCase() + "</strong><br>Practice round complete";

                showToast(matched
                    ? "Your selection matched the practice result!"
                    : "Practice round complete. Check the result.");

                // Demo credit does not change. This is not a real-money game transaction.
                roundTimeout = setTimeout(resetRound, RESULT_DISPLAY_MS);
            }

            function submitFlip() {
                if (roundLocked || roundSubmitted) return;

                if (!selectedSide) {
                    showToast("Please choose Heads or Tails first.");
                    return;
                }

                const amount = validateAmount();
                if (amount === null) return;

                selectedAmount = amount;
                roundSubmitted = true;
                setRoundLocked(true);

                $("resultBox").classList.remove("show");
                clearCoinAnimation();

                // Randomly generated local demo result.
                const result = Math.random() < 0.5 ? "heads" : "tails";

                // Animate toward the face that matches the generated result.
                coin.classList.add(result === "heads" ? "flip-heads" : "flip-tails");

                coinStatus.innerHTML =
                    "<strong>Coin is flipping...</strong><br>Preparing simulated result";

                roundTimeout = setTimeout(() => {
                    // Explicitly settle the coin on the generated side after animation.
                    coin.classList.remove("flip-heads", "flip-tails");
                    coin.style.transform = result === "heads"
                        ? "rotateY(0deg)"
                        : "rotateY(180deg)";

                    showResult(result);
                }, FLIP_DURATION);
            }

            function resetRound() {
                clearTimeout(roundTimeout);
                roundTimeout = null;

                roundNumber += 1;
                secondsLeft = ROUND_SECONDS;
                selectedSide = null;
                roundSubmitted = false;

                sideButtons.forEach((button) => {
                    button.classList.remove("selected");
                    button.setAttribute("aria-pressed", "false");
                });

                $("selectedSide").textContent = "None selected";
                $("resultBox").classList.remove("show");

                clearCoinAnimation();
                coinStatus.innerHTML =
                    "<strong>Ready to flip?</strong><br>Choose your side below";

                setRoundLocked(false);
                renderTimer();
            }

            sideButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    setSelectedSide(button.dataset.side);
                });
            });

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

            flipButton.addEventListener("click", submitFlip);

            // A single countdown interval controls each practice round.
            setInterval(() => {
                if (roundLocked) return;

                if (secondsLeft > 0) {
                    secondsLeft -= 1;
                    renderTimer();
                }

                if (secondsLeft === 0 && !roundSubmitted) {
                    setRoundLocked(true);

                    coinStatus.innerHTML =
                        "<strong>Round expired</strong><br>Preparing a new practice round";

                    showToast("Time expired. No result was generated for this round.");

                    roundTimeout = setTimeout(resetRound, 1400);
                }
            }, 1000);

            // Simple mobile navigation helper.
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

            renderBalance();
            renderTimer();
            renderHistory();
        })();
