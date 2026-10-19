
        (() => {
            "use strict";

            /*
             * BACKEND CONTRACT
             *
             * GET  /api/watch-earn/videos
             * Expected: { videos: [{ id, title, description, videoUrl,
             *   thumbnailUrl, requiredWatchSeconds, rewardAmount, claimed }] }
             *
             * GET  /api/watch-earn/summary
             * Expected: { totalEarnings, completedCount, walletBalance }
             *
             * POST /api/watch-earn/complete
             * Request: { videoId, watchedSeconds, sessionId }
             * Expected: { success: true, credited: true, rewardAmount, ... }
             *
             * These routes are integration contracts, not existing verified APIs.
             * Adjust them to match the real KUDIX backend.
             */

            const API_BASE = "/api";
            const DEFAULT_REWARD = 1400;

            const feed = document.getElementById("videoFeed");
            const toast = document.getElementById("toast");

            const state = {
                videos: [],
                summary: null,
                activeVideoId: null,
                loading: false
            };

            const sessions = new Map();
            let toastTimer;

            function money(value) {
                const number = Number(value);
                if (!Number.isFinite(number)) return "—";

                return "₦" + number.toLocaleString("en-NG", {
                    maximumFractionDigits: 2
                });
            }

            function escapeHTML(value) {
                return String(value ?? "").replace(/[&<>"']/g, char => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                })[char]);
            }

            function showToast(message, isError = false) {
                clearTimeout(toastTimer);
                toast.textContent = message;
                toast.classList.toggle("error", isError);
                toast.hidden = false;

                toastTimer = setTimeout(() => {
                    toast.hidden = true;
                }, 4500);
            }

            async function api(path, options = {}) {
                const response = await fetch(API_BASE + path, {
                    credentials: "same-origin",
                    ...options,
                    headers: {
                        Accept: "application/json",
                        ...(options.body ? { "Content-Type": "application/json" } : {}),
                        ...options.headers
                    }
                });

                if (response.status === 401) {
                    throw new Error("Please sign in to access Watch & Earn.");
                }

                if (!response.ok) {
                    throw new Error("The request could not be completed. Please try again.");
                }

                return response.json();
            }

            function updateSummary(data) {
                state.summary = data;

                document.getElementById("totalEarnings").textContent =
                    money(data.totalEarnings);

                document.getElementById("completedCount").textContent =
                    Number.isFinite(Number(data.completedCount))
                        ? Number(data.completedCount).toLocaleString("en-NG")
                        : "—";

                document.getElementById("topWallet").textContent =
                    money(data.walletBalance);
            }

            function validateVideo(video) {
                return video &&
                    video.id !== undefined &&
                    typeof video.title === "string" &&
                    typeof video.videoUrl === "string" &&
                    video.videoUrl.length > 0;
            }

            function renderEmpty(title, description, retry = false) {
                feed.innerHTML = `
            <div class="state-card">
                <div class="state-icon">${retry ? "↻" : "▷"}</div>
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(description)}</p>
                ${retry
                        ? '<button class="earn-button" id="retryButton">Try again</button>'
                        : ""}
            </div>
        `;

                const retryButton = document.getElementById("retryButton");
                if (retryButton) {
                    retryButton.addEventListener("click", loadPage);
                }
            }

            function statusFor(video) {
                if (video.claimed === true) {
                    return { text: "Reward claimed", className: "completed" };
                }

                if (sessions.get(String(video.id))?.pending) {
                    return { text: "Verifying", className: "pending" };
                }

                return { text: "Reward available", className: "available" };
            }

            function renderVideo(video) {
                const id = escapeHTML(video.id);
                const title = escapeHTML(video.title);
                const description = escapeHTML(video.description || "");
                const poster = escapeHTML(video.thumbnailUrl || "");
                const status = statusFor(video);
                const claimed = video.claimed === true;
                const reward = Number.isFinite(Number(video.rewardAmount))
                    ? Number(video.rewardAmount)
                    : DEFAULT_REWARD;

                const session = sessions.get(String(video.id));
                const watched = session?.watchedSeconds || 0;
                const required = Math.max(
                    1,
                    Number(video.requiredWatchSeconds) || 30
                );

                const progress = Math.min(100, (watched / required) * 100);

                return `
            <article class="video-card" data-video-id="${id}">
                <div class="video-top">
                    <div class="video-meta">
                        <div class="video-publisher-icon">K</div>
                        <div class="video-meta-text">
                            <strong>KUDIX Videos</strong>
                            <small>Published content</small>
                        </div>
                    </div>
                    <span class="status-badge ${status.className}"
                          data-status="${id}">
                        ${status.text}
                    </span>
                </div>

                <div class="video-stage">
                    <video
                        class="video-player"
                        data-player="${id}"
                        src="${escapeHTML(video.videoUrl)}"
                        ${poster ? `poster="${poster}"` : ""}
                        playsinline
                        preload="metadata"
                        controls
                        aria-label="${title}"
                    ></video>

                    <div class="video-overlay">
                        <div class="overlay-top">
                            <span class="reward-overlay">
                                ${money(reward)} reward
                            </span>
                            <button
                                class="overlay-action mute-button"
                                data-mute="${id}"
                                type="button"
                                aria-label="Mute or unmute video"
                                title="Mute or unmute"
                            >♪</button>
                        </div>
                        <div class="overlay-bottom">
                            <span></span>
                            <button
                                class="overlay-action fullscreen-button"
                                data-fullscreen="${id}"
                                type="button"
                                aria-label="View video fullscreen"
                                title="Full screen"
                            >⛶</button>
                        </div>
                    </div>

                    <div class="video-progress" aria-hidden="true">
                        <div class="video-progress-fill"
                             data-progress="${id}"
                             style="width:${progress}%"></div>
                    </div>
                </div>

                <div class="video-info">
                    <h3>${title}</h3>
                    ${description
                        ? `<p class="video-description">${description}</p>`
                        : ""}

                    <div class="video-bottom">
                        <p class="watch-time" data-watch-label="${id}">
                            Watch progress:
                            <strong>${Math.floor(watched)}s / ${required}s</strong>
                        </p>

                        <button
                            type="button"
                            class="earn-button ${claimed ? "claimed" : ""}"
                            data-claim="${id}"
                            ${claimed || session?.pending ? "disabled" : ""}
                        >
                            ${claimed
                        ? "✓ Reward claimed"
                        : session?.pending
                            ? "Verifying reward…"
                            : "Watch to earn " + money(reward)}
                        </button>
                    </div>
                </div>
            </article>
        `;
            }

            function renderFeed() {
                if (!state.videos.length) {
                    renderEmpty(
                        "No videos available right now",
                        "New videos will appear here when KUDIX publishes them."
                    );
                    return;
                }

                feed.innerHTML = state.videos.map(renderVideo).join("");

                feed.querySelectorAll("[data-player]").forEach(player => {
                    player.addEventListener("play", () => {
                        state.activeVideoId = player.dataset.player;

                        feed.querySelectorAll("[data-player]").forEach(other => {
                            if (other !== player) other.pause();
                        });

                        const video = state.videos.find(
                            item => String(item.id) === player.dataset.player
                        );

                        if (video && video.claimed !== true) {
                            beginSession(video, player);
                        }
                    });

                    player.addEventListener("timeupdate", () => {
                        trackProgress(player);
                    });

                    player.addEventListener("ended", () => {
                        trackProgress(player);
                    });

                    player.addEventListener("error", () => {
                        showToast(
                            "This video could not be loaded. Please try again later.",
                            true
                        );
                    });
                });

                feed.querySelectorAll("[data-mute]").forEach(button => {
                    button.addEventListener("click", () => {
                        const player = feed.querySelector(
                            `[data-player="${CSS.escape(button.dataset.mute)}"]`
                        );

                        if (!player) return;

                        player.muted = !player.muted;
                        button.textContent = player.muted ? "×" : "♪";
                        button.setAttribute(
                            "aria-label",
                            player.muted ? "Unmute video" : "Mute video"
                        );
                    });
                });

                feed.querySelectorAll("[data-fullscreen]").forEach(button => {
                    button.addEventListener("click", async () => {
                        const player = feed.querySelector(
                            `[data-player="${CSS.escape(button.dataset.fullscreen)}"]`
                        );

                        if (!player) return;

                        try {
                            if (document.fullscreenElement) {
                                await document.exitFullscreen();
                            } else if (player.requestFullscreen) {
                                await player.requestFullscreen();
                            } else if (player.webkitEnterFullscreen) {
                                player.webkitEnterFullscreen();
                            }
                        } catch {
                            showToast("Full-screen playback is unavailable.", true);
                        }
                    });
                });

                feed.querySelectorAll("[data-claim]").forEach(button => {
                    button.addEventListener("click", () => {
                        const video = state.videos.find(
                            item => String(item.id) === button.dataset.claim
                        );

                        if (video) requestReward(video);
                    });
                });
            }

            function beginSession(video, player) {
                const key = String(video.id);

                if (sessions.has(key)) return;

                sessions.set(key, {
                    watchedSeconds: 0,
                    lastTime: player.currentTime,
                    lastTick: performance.now(),
                    pending: false,
                    sessionId: null,
                    maxTime: player.currentTime,
                    started: true
                });
            }

            function trackProgress(player) {
                const key = String(player.dataset.player);
                const video = state.videos.find(item => String(item.id) === key);

                if (!video || video.claimed === true || player.paused || player.seeking) {
                    return;
                }

                let session = sessions.get(key);

                if (!session) {
                    beginSession(video, player);
                    session = sessions.get(key);
                }

                const now = performance.now();
                const delta = (now - session.lastTick) / 1000;
                const mediaDelta = player.currentTime - session.lastTime;

                /*
                 * Client progress is only a user-interface indicator.
                 * The server must independently validate viewing eligibility.
                 * Seek jumps and background tab time are not counted here.
                 */
                if (
                    delta > 0 &&
                    delta < 2.5 &&
                    mediaDelta > 0 &&
                    mediaDelta <= delta * 1.8 &&
                    !document.hidden
                ) {
                    session.watchedSeconds += Math.min(delta, mediaDelta);
                    session.maxTime = Math.max(session.maxTime, player.currentTime);
                }

                session.lastTime = player.currentTime;
                session.lastTick = now;

                const required = Math.max(
                    1,
                    Number(video.requiredWatchSeconds) || 30
                );

                const progress = Math.min(
                    100,
                    (session.watchedSeconds / required) * 100
                );

                const progressBar = feed.querySelector(`[data-progress="${CSS.escape(key)}"]`);
                const label = feed.querySelector(`[data-watch-label="${CSS.escape(key)}"]`);

                if (progressBar) progressBar.style.width = progress + "%";

                if (label) {
                    label.innerHTML = `Watch progress: <strong>${Math.floor(session.watchedSeconds)
                        }s / ${required}s</strong>`;
                }
            }

            async function requestReward(video) {
                const key = String(video.id);
                const session = sessions.get(key);
                const required = Math.max(
                    1,
                    Number(video.requiredWatchSeconds) || 30
                );

                if (video.claimed === true) {
                    showToast("You have already claimed this video reward.");
                    return;
                }

                if (!session || session.watchedSeconds < required) {
                    showToast(
                        `Keep watching to meet the required ${required}-second duration.`
                    );
                    return;
                }

                if (session.pending) return;

                session.pending = true;
                renderFeed();

                try {
                    /*
                     * The backend must validate the authenticated user,
                     * watch session, duration, video eligibility and duplicate
                     * claims. Never credit a wallet from this browser code.
                     */
                    const result = await api("/watch-earn/complete", {
                        method: "POST",
                        body: JSON.stringify({
                            videoId: video.id,
                            watchedSeconds: Math.floor(session.watchedSeconds),
                            sessionId: session.sessionId
                        })
                    });

                    if (result.success !== true || result.credited !== true) {
                        throw new Error(
                            result.message ||
                            "The reward has not been confirmed. Please try again."
                        );
                    }

                    video.claimed = true;
                    video.rewardAmount = Number(result.rewardAmount) || DEFAULT_REWARD;

                    renderFeed();

                    showToast(
                        `Reward confirmed: ${money(video.rewardAmount)} credited.`
                    );

                    await loadSummary();
                } catch (error) {
                    session.pending = false;
                    renderFeed();
                    showToast(
                        error.message || "Reward verification failed. Please try again.",
                        true
                    );
                }
            }

            async function loadSummary() {
                const data = await api("/watch-earn/summary");
                updateSummary(data);
            }

            async function loadPage() {
                if (state.loading) return;

                state.loading = true;

                feed.innerHTML =
                    '<div class="skeleton skeleton-card" aria-label="Loading videos"></div>';

                try {
                    const [videoData, summaryData] = await Promise.all([
                        api("/watch-earn/videos"),
                        api("/watch-earn/summary")
                    ]);

                    if (!Array.isArray(videoData.videos)) {
                        throw new Error("The video feed returned an invalid response.");
                    }

                    state.videos = videoData.videos.filter(validateVideo);
                    updateSummary(summaryData);
                    renderFeed();
                } catch (error) {
                    renderEmpty(
                        "Unable to load Watch & Earn",
                        error.message ||
                        "Please check your connection and try again.",
                        true
                    );
                } finally {
                    state.loading = false;
                }
            }

            /*
             * Stop background playback and reset timing baselines when the
             * browser tab is hidden. The server remains responsible for
             * final reward verification.
             */
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    feed.querySelectorAll("[data-player]").forEach(player => {
                        player.pause();
                    });
                }

                sessions.forEach(session => {
                    session.lastTick = performance.now();
                });
            });

            loadPage();
        })();
 