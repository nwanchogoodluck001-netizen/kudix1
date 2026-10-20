
        /*
         * KUDIX SOCIAL TASK BACKEND CONFIGURATION
         *
         * Replace API_URL and the action names with the real routes
         * and response formats used by the existing KUDIX PHP backend.
         *
         * No mock records or simulated financial transactions are used.
         */
        const API_URL = 'admin_social_api.php';

        const API_ACTIONS = {
            dashboard: 'dashboard',
            saveReward: 'save_reward',
            createTask: 'create_task',
            pendingProofs: 'pending_proofs',
            approveProof: 'approve_proof',
            rejectProof: 'reject_proof',
            approveAll: 'approve_all'
        };

        const PAGE_SIZE = 10;

        const state = {
            proofs: [],
            page: 1,
            total: 0,
            totalPages: 1,
            search: '',
            loading: false,
            initialized: false
        };

        const $ = (id) => document.getElementById(id);

        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]);
        }

        function formatNaira(value) {
            const amount = Number(value);

            if (!Number.isFinite(amount)) return '—';

            return new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }

        function formatDate(value) {
            if (!value) return '—';

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return String(value);
            }

            return date.toLocaleString('en-NG', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function showAlert(message, type = 'success') {
            const box = $('alertBox');

            box.textContent = message;
            box.className = `alert show ${type}`;

            clearTimeout(showAlert.timer);
            showAlert.timer = setTimeout(() => {
                box.classList.remove('show');
            }, 4500);
        }

        async function apiRequest(action, options = {}) {
            const url = new URL(API_URL, window.location.href);
            url.searchParams.set('action', action);

            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...(options.body instanceof FormData
                        ? {}
                        : options.body
                            ? { 'Content-Type': 'application/json' }
                            : {}),
                    ...(window.KUDIX_CSRF_TOKEN
                        ? { 'X-CSRF-Token': window.KUDIX_CSRF_TOKEN }
                        : {}),
                    ...options.headers
                },
                ...options
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data || data.success !== true) {
                throw new Error(
                    data?.message ||
                    `The server request failed (${response.status}).`
                );
            }

            return data;
        }

        function setButtonLoading(button, loading, loadingText = 'Please wait...') {
            if (loading) {
                button.dataset.originalText = button.textContent;
                button.textContent = loadingText;
                button.disabled = true;
            } else {
                button.textContent = button.dataset.originalText || button.textContent;
                button.disabled = false;
            }
        }

        async function loadDashboard() {
            try {
                const result = await apiRequest(API_ACTIONS.dashboard);
                const data = result.data || result;

                if (data.global_reward !== undefined) {
                    $('globalReward').textContent = formatNaira(data.global_reward);
                    $('rewardAmount').value = data.reward_per_task ?? data.global_reward;
                } else if (data.reward_per_task !== undefined) {
                    $('rewardAmount').value = data.reward_per_task;
                }

                if (data.pending_proofs !== undefined) {
                    $('pendingCount').textContent = Number(data.pending_proofs).toLocaleString('en-NG');
                }

                if (data.active_tasks !== undefined) {
                    $('activeCount').textContent = Number(data.active_tasks).toLocaleString('en-NG');
                }
            } catch (error) {
                showAlert(
                    'Could not load dashboard statistics. Check the backend connection.',
                    'error'
                );
                console.error('Dashboard loading failed:', error);
            }
        }

        async function loadProofs() {
            const tbody = $('proofTableBody');

            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="table-status">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        Loading user submissions...
                    </td>
                </tr>`;

            try {
                const result = await apiRequest(API_ACTIONS.pendingProofs, {
                    method: 'POST',
                    body: JSON.stringify({
                        page: state.page,
                        per_page: PAGE_SIZE,
                        search: state.search
                    })
                });

                const data = result.data || result;

                state.proofs = Array.isArray(data.items) ? data.items : [];
                state.total = Number(data.total ?? state.proofs.length);
                state.totalPages = Math.max(
                    1,
                    Number(data.total_pages ?? Math.ceil(state.total / PAGE_SIZE))
                );

                renderProofs();
                updatePagination();
            } catch (error) {
                state.proofs = [];
                state.total = 0;
                state.totalPages = 1;

                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="table-status">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            Unable to load pending proofs. Check the API configuration
                            and server connection, then try again.
                        </td>
                    </tr>`;

                updatePagination();
                console.error('Proof loading failed:', error);
            }
        }

        function renderProofs() {
            const tbody = $('proofTableBody');

            if (!state.proofs.length) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="table-status">
                            <i class="fa-regular fa-folder-open"></i>
                            No pending submissions were returned by the server.
                        </td>
                    </tr>`;
                return;
            }

            tbody.innerHTML = state.proofs.map(proof => {
                const id = escapeHTML(proof.id);
                const username = escapeHTML(proof.username);
                const taskTitle = escapeHTML(proof.task_title);
                const date = escapeHTML(formatDate(proof.created_at));
                const image = proof.proof_image
                    ? escapeHTML(proof.proof_image)
                    : '';

                const imageMarkup = image
                    ? `<img
                        class="proof-thumbnail"
                        src="${image}"
                        alt="Proof submitted by ${username}"
                        loading="lazy"
                        data-proof-image="${image}"
                        data-proof-user="${username}"
                    >`
                    : `<div class="proof-placeholder" title="No proof image available">
                        <i class="fa-regular fa-image"></i>
                    </div>`;

                return `
                    <tr data-proof-id="${id}">
                        <td>${username}</td>
                        <td class="task-cell">${taskTitle}</td>
                        <td>${imageMarkup}</td>
                        <td>${date}</td>
                        <td>
                            <div class="action-buttons">
                                <button
                                    class="success-button"
                                    type="button"
                                    data-action="approve"
                                    data-id="${id}"
                                >Approve</button>
                                <button
                                    class="danger-button"
                                    type="button"
                                    data-action="reject"
                                    data-id="${id}"
                                >Reject</button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        }

        function updatePagination() {
            const start = state.total === 0
                ? 0
                : (state.page - 1) * PAGE_SIZE + 1;

            const end = Math.min(state.page * PAGE_SIZE, state.total);

            $('paginationInfo').textContent =
                state.total === 0
                    ? 'No records'
                    : `Showing ${start}–${end} of ${state.total} submissions`;

            $('currentPage').textContent = state.page;
            $('previousPage').disabled = state.page <= 1;
            $('nextPage').disabled = state.page >= state.totalPages;
        }

        async function refreshData() {
            await Promise.all([
                loadDashboard(),
                loadProofs()
            ]);
        }

        $('rewardForm').addEventListener('submit', async event => {
            event.preventDefault();

            const button = $('saveRewardButton');
            const amount = Number($('rewardAmount').value);

            if (!Number.isFinite(amount) || amount < 0) {
                showAlert('Enter a valid reward amount.', 'error');
                return;
            }

            setButtonLoading(button, true, 'Saving...');

            try {
                await apiRequest(API_ACTIONS.saveReward, {
                    method: 'POST',
                    body: JSON.stringify({ amount })
                });

                showAlert('Reward settings saved successfully.');
                await loadDashboard();
            } catch (error) {
                showAlert(error.message || 'Could not save reward settings.', 'error');
            } finally {
                setButtonLoading(button, false);
            }
        });

        $('taskImage').addEventListener('change', () => {
            const file = $('taskImage').files[0];
            const preview = $('imagePreview');

            if (!file) {
                preview.removeAttribute('src');
                preview.style.display = 'none';
                return;
            }

            const allowedTypes = [
                'image/jpeg',
                'image/png',
                'image/webp'
            ];

            if (!allowedTypes.includes(file.type)) {
                $('taskImage').value = '';
                preview.style.display = 'none';
                showAlert('Choose a JPG, PNG, or WebP image.', 'error');
                return;
            }

            const maxSize = 5 * 1024 * 1024;

            if (file.size > maxSize) {
                $('taskImage').value = '';
                preview.style.display = 'none';
                showAlert('The image must not exceed 5 MB.', 'error');
                return;
            }

            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        });

        $('taskForm').addEventListener('submit', async event => {
            event.preventDefault();

            const button = $('createTaskButton');
            const title = $('taskTitle').value.trim();
            const actionLink = $('taskLink').value.trim();
            const file = $('taskImage').files[0];

            if (!title) {
                showAlert('Enter the task title or instructions.', 'error');
                return;
            }

            if (actionLink) {
                try {
                    const parsedURL = new URL(actionLink);

                    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
                        throw new Error('Invalid protocol');
                    }
                } catch {
                    showAlert('Enter a valid HTTP or HTTPS action link.', 'error');
                    return;
                }
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('action_link', actionLink);

            if (file) {
                formData.append('banner', file);
            }

            setButtonLoading(button, true, 'Adding task...');

            try {
                await apiRequest(API_ACTIONS.createTask, {
                    method: 'POST',
                    body: formData
                });

                $('taskForm').reset();
                $('imagePreview').removeAttribute('src');
                $('imagePreview').style.display = 'none';

                showAlert('Task created successfully.');
                await refreshData();
            } catch (error) {
                showAlert(error.message || 'Could not create the task.', 'error');
            } finally {
                setButtonLoading(button, false);
            }
        });

        function openConfirmModal(title, message, confirmText, onConfirm, danger = false) {
            $('modalTitle').textContent = title;
            $('modalMessage').textContent = message;

            const confirmButton = $('confirmModalButton');
            confirmButton.textContent = confirmText;
            confirmButton.className = danger
                ? 'danger-button'
                : 'success-button';

            $('confirmModal').classList.add('show');

            const close = () => {
                $('confirmModal').classList.remove('show');
                confirmButton.onclick = null;
                $('cancelModal').onclick = null;
            };

            $('cancelModal').onclick = close;

            confirmButton.onclick = async () => {
                confirmButton.disabled = true;
                confirmButton.textContent = 'Processing...';

                try {
                    await onConfirm();
                    close();
                } catch (error) {
                    showAlert(error.message || 'The operation failed.', 'error');
                } finally {
                    confirmButton.disabled = false;
                    confirmButton.textContent = confirmText;
                }
            };
        }

        async function changeProofStatus(id, action) {
            const isApprove = action === 'approve';

            const result = await apiRequest(
                isApprove
                    ? API_ACTIONS.approveProof
                    : API_ACTIONS.rejectProof,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        proof_id: id
                    })
                }
            );

            showAlert(
                result.message ||
                (isApprove
                    ? 'Submission approved.'
                    : 'Submission rejected.')
            );

            await refreshData();
        }

        $('proofTableBody').addEventListener('click', event => {
            const actionButton = event.target.closest('button[data-action]');

            if (actionButton) {
                const id = actionButton.dataset.id;
                const action = actionButton.dataset.action;

                if (!id) {
                    showAlert('The submission ID is missing.', 'error');
                    return;
                }

                if (action === 'approve') {
                    openConfirmModal(
                        'Approve submission?',
                        'The server will verify this pending submission and process its configured reward if eligible.',
                        'Approve',
                        () => changeProofStatus(id, 'approve')
                    );
                } else {
                    openConfirmModal(
                        'Reject submission?',
                        'This submission will be marked as rejected if it is still pending.',
                        'Reject',
                        () => changeProofStatus(id, 'reject'),
                        true
                    );
                }

                return;
            }

            const image = event.target.closest('[data-proof-image]');

            if (image) {
                $('imageModalTitle').textContent =
                    `Proof submitted by ${image.dataset.proofUser || 'user'}`;

                $('expandedProofImage').src = image.dataset.proofImage;
                $('imageModal').classList.add('show');
            }
        });

        $('closeImageModal').addEventListener('click', () => {
            $('imageModal').classList.remove('show');
            $('expandedProofImage').removeAttribute('src');
        });

        $('imageModal').addEventListener('click', event => {
            if (event.target === $('imageModal')) {
                $('imageModal').classList.remove('show');
                $('expandedProofImage').removeAttribute('src');
            }
        });

        $('approveAllButton').addEventListener('click', () => {
            if (state.total === 0) {
                showAlert('There are no pending submissions to approve.', 'error');
                return;
            }

            openConfirmModal(
                'Approve all pending submissions?',
                'The server must verify and process every eligible pending submission individually. Only successfully processed submissions should receive rewards. This action may affect many users.',
                'Approve All',
                async () => {
                    const result = await apiRequest(API_ACTIONS.approveAll, {
                        method: 'POST',
                        body: JSON.stringify({
                            search: state.search
                        })
                    });

                    const data = result.data || result;
                    const approved = Number(data.approved ?? 0);
                    const failed = Number(data.failed ?? 0);

                    showAlert(
                        result.message ||
                        `Approved: ${approved}. Failed: ${failed}.`,
                        failed > 0 ? 'error' : 'success'
                    );

                    await refreshData();
                }
            );
        });

        let searchTimer;

        $('searchInput').addEventListener('input', event => {
            clearTimeout(searchTimer);

            searchTimer = setTimeout(async () => {
                state.search = event.target.value.trim();
                state.page = 1;
                await loadProofs();
            }, 300);
        });

        $('previousPage').addEventListener('click', async () => {
            if (state.page > 1) {
                state.page--;
                await loadProofs();
            }
        });

        $('nextPage').addEventListener('click', async () => {
            if (state.page < state.totalPages) {
                state.page++;
                await loadProofs();
            }
        });

        const sidebar = $('sidebar');
        const sidebarOverlay = $('sidebarOverlay');

        function closeSidebar() {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        }

        $('sidebarToggle').addEventListener('click', () => {
            const isOpen = sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('show', isOpen);
        });

        sidebarOverlay.addEventListener('click', closeSidebar);

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeSidebar();
                $('confirmModal').classList.remove('show');
                $('imageModal').classList.remove('show');
            }
        });

        async function initializePage() {
            if (state.initialized) return;
            state.initialized = true;
            await refreshData();
        }

        initializePage();
