
        /*
         * KUDIX MANAGE USERS
         *
         * Connect these expected endpoints to the existing backend.
         * No demo users or fabricated balances are inserted.
         *
         * Expected routes below are integration placeholders, not
         * verified existing routes.
         */
        const API_BASE = '/admin/api/manage-users.php';

        const API = {
            list: `${API_BASE}?action=list`,
            preview: `${API_BASE}?action=preview`,
            suspend: `${API_BASE}?action=suspend`,
            reactivate: `${API_BASE}?action=reactivate`
        };

        const state = {
            users: [],
            page: 1,
            pageSize: 10,
            total: 0,
            totalPages: 1,
            search: '',
            status: '',
            accountType: '',
            selectedUser: null,
            action: null,
            busy: false
        };

        const $ = id => document.getElementById(id);

        function escapeHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[char]);
        }

        function formatNumber(value) {
            const number = Number(value);

            if (!Number.isFinite(number)) return '—';

            return new Intl.NumberFormat('en-NG', {
                maximumFractionDigits: 0
            }).format(number);
        }

        function formatMoney(value) {
            const number = Number(value);

            if (!Number.isFinite(number)) return '—';

            return '₦' + new Intl.NumberFormat('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(number);
        }

        function formatDate(value) {
            if (!value) return '—';

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return '—';
            }

            return date.toLocaleString('en-NG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function showAlert(message, type = 'success') {
            const alert = $('alertBox');

            alert.textContent = message;
            alert.className = `alert show ${type}`;

            clearTimeout(showAlert.timer);

            showAlert.timer = setTimeout(() => {
                alert.classList.remove('show');
            }, 4500);
        }

        async function apiRequest(url, options = {}) {
            const headers = {
                'Accept': 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(window.KUDIX_CSRF_TOKEN
                    ? { 'X-CSRF-Token': window.KUDIX_CSRF_TOKEN }
                    : {})
            };

            const response = await fetch(url, {
                credentials: 'same-origin',
                ...options,
                headers: {
                    ...headers,
                    ...options.headers
                }
            });

            const result = await response.json().catch(() => null);

            if (!response.ok || !result || result.success !== true) {
                throw new Error(
                    result?.message ||
                    `Request failed (${response.status}).`
                );
            }

            return result;
        }

        function setLoadingRow(message, icon = 'bx-loader-circle bx-spin') {
            $('usersTableBody').innerHTML = `
                <tr>
                    <td colspan="6" class="table-state">
                        <i class="bx ${icon}"></i>
                        ${escapeHTML(message)}
                    </td>
                </tr>`;
        }

        function setSummary(data) {
            const summary = data.summary || data;

            const total = summary.total_users;
            const active = summary.active_users;
            const suspended = summary.suspended_users;
            const levelled = summary.levelled_up_users;

            $('headerTotalUsers').textContent =
                total === undefined ? '—' : formatNumber(total);

            $('totalUsers').textContent =
                total === undefined ? '—' : formatNumber(total);

            $('activeUsers').textContent =
                active === undefined ? '—' : formatNumber(active);

            $('suspendedUsers').textContent =
                suspended === undefined ? '—' : formatNumber(suspended);

            $('levelledUsers').textContent =
                levelled === undefined ? '—' : formatNumber(levelled);
        }

        async function loadUsers() {
            if (state.busy) return;

            state.busy = true;
            setLoadingRow('Loading registered users...');

            const params = new URLSearchParams({
                page: String(state.page),
                per_page: String(state.pageSize),
                search: state.search,
                status: state.status,
                account_type: state.accountType
            });

            try {
                const result = await apiRequest(`${API.list}&${params.toString()}`);
                const data = result.data || result;

                state.users = Array.isArray(data.users) ? data.users : [];
                state.total = Number(data.total ?? 0);
                state.totalPages = Math.max(
                    1,
                    Number(data.total_pages ?? Math.ceil(state.total / state.pageSize))
                );

                setSummary(data);
                renderUsers();
                updatePagination();
            } catch (error) {
                state.users = [];
                state.total = 0;
                state.totalPages = 1;

                setLoadingRow(
                    'Unable to load users. Check the backend connection and try again.',
                    'bx-error-circle'
                );

                updatePagination();

                showAlert(error.message || 'Could not load users.', 'error');
                console.error('User list error:', error);
            } finally {
                state.busy = false;
            }
        }

        function getAccountType(user) {
            const type = String(user.account_type || '').toLowerCase();

            if (user.level_up_pending === true || type === 'pending') {
                return {
                    label: 'Level Up Pending',
                    className: 'badge-pending'
                };
            }

            if (
                user.has_leveled_up === true ||
                user.has_leveled_up === 1 ||
                type === 'levelled_up' ||
                type === 'leveled_up'
            ) {
                return {
                    label: 'Leveled Up',
                    className: 'badge-levelled'
                };
            }

            return {
                label: 'Standard',
                className: 'badge-standard'
            };
        }

        function isSuspended(user) {
            return user.is_suspended === true ||
                user.is_suspended === 1 ||
                String(user.account_status || '').toLowerCase() === 'suspended';
        }

        function renderUsers() {
            const tbody = $('usersTableBody');

            if (!state.users.length) {
                setLoadingRow('No users found matching your search.', 'bx-user-x');
                return;
            }

            tbody.innerHTML = state.users.map(user => {
                const id = String(user.id ?? '');
                const username = String(user.username ?? 'Unknown user');
                const suspended = isSuspended(user);
                const accountType = getAccountType(user);

                const avatarLetter = username.trim().charAt(0).toUpperCase() || '?';

                return `
                    <tr>
                        <td>
                            <div class="username">
                                <div class="user-avatar">${escapeHTML(avatarLetter)}</div>
                                <div>
                                    <div class="username-text">${escapeHTML(username)}</div>
                                    <div class="user-id">ID: ${escapeHTML(id || '—')}</div>
                                </div>
                            </div>
                        </td>

                        <td>
                            <span class="balance referral">
                                ${formatMoney(user.referral_balance)}
                            </span>
                        </td>

                        <td>
                            <span class="balance activity">
                                ${formatMoney(user.activity_balance)}
                            </span>
                        </td>

                        <td>
                            <div class="account-cell">
                                <span class="badge ${accountType.className}">
                                    ${escapeHTML(accountType.label)}
                                </span>

                                <span class="badge ${suspended ? 'badge-suspended' : 'badge-active'}">
                                    ${suspended ? 'Suspended' : 'Active'}
                                </span>
                            </div>
                        </td>

                        <td>
                            <button
                                class="btn btn-blue"
                                type="button"
                                data-action="preview"
                                data-id="${escapeHTML(id)}"
                            >
                                <i class="bx bx-show"></i> Preview
                            </button>
                        </td>

                        <td>
                            <button
                                class="btn ${suspended ? 'btn-green' : 'btn-red'}"
                                type="button"
                                data-action="${suspended ? 'reactivate' : 'suspend'}"
                                data-id="${escapeHTML(id)}"
                                data-username="${escapeHTML(username)}"
                            >
                                <i class="bx ${suspended ? 'bx-check-circle' : 'bx-block'}"></i>
                                ${suspended ? 'Reactivate' : 'Suspend Account'}
                            </button>
                        </td>
                    </tr>`;
            }).join('');
        }

        function updatePagination() {
            const start = state.total
                ? ((state.page - 1) * state.pageSize) + 1
                : 0;

            const end = Math.min(state.page * state.pageSize, state.total);

            $('paginationInfo').textContent = state.total
                ? `Showing ${start}–${end} of ${formatNumber(state.total)} users`
                : 'No user records';

            $('currentPage').textContent = state.page;
            $('prevPage').disabled = state.page <= 1 || state.busy;
            $('nextPage').disabled = state.page >= state.totalPages || state.busy;
        }

        function openModal(id) {
            $(id).classList.add('show');
        }

        function closeModal(id) {
            $(id).classList.remove('show');
        }

        document.querySelectorAll('[data-close]').forEach(button => {
            button.addEventListener('click', () => {
                closeModal(button.dataset.close);
            });
        });

        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', event => {
                if (event.target === backdrop) {
                    closeModal(backdrop.id);
                }
            });
        });

        async function previewUser(id) {
            $('previewBody').innerHTML = `
                <div class="table-state">
                    <i class="bx bx-loader-circle bx-spin"></i>
                    Retrieving user details from the server...
                </div>`;

            openModal('previewModal');

            try {
                const params = new URLSearchParams({ user_id: id });
                const result = await apiRequest(`${API.preview}&${params.toString()}`);
                const user = result.data?.user || result.user || result.data;

                if (!user || user.id === undefined) {
                    throw new Error('The server returned incomplete user details.');
                }

                state.selectedUser = user;

                const accountType = getAccountType(user);
                const suspended = isSuspended(user);

                const details = [
                    ['User ID', user.id],
                    ['Username', user.username],
                    ['Registration Date', formatDate(user.created_at)],
                    ['Account Type', accountType.label],
                    ['Account Status', suspended ? 'Suspended' : 'Active'],
                    ['Referral Balance', formatMoney(user.referral_balance)],
                    ['Activity Balance', formatMoney(user.activity_balance)],
                    ['Promotional Gaming Credit', formatMoney(user.promotional_balance)],
                    ['Withdrawable Balance', formatMoney(user.withdrawable_balance)],
                    ['Pending Withdrawals', formatMoney(user.pending_withdrawal_amount)],
                    ['Qualified Referrals', user.qualified_referrals],
                    ['Total Verified Earnings', formatMoney(user.verified_earnings)]
                ];

                $('previewTitle').textContent = `${user.username || 'User'} — Preview`;

                $('previewBody').innerHTML = `
                    <div class="profile-summary">
                        <div class="user-avatar">
                            ${escapeHTML(String(user.username || '?').charAt(0).toUpperCase())}
                        </div>
                        <div>
                            <div class="profile-name">${escapeHTML(user.username || 'Unknown user')}</div>
                            <div class="profile-id">User ID: ${escapeHTML(user.id)}</div>
                            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                                <span class="badge ${accountType.className}">
                                    ${escapeHTML(accountType.label)}
                                </span>
                                <span class="badge ${suspended ? 'badge-suspended' : 'badge-active'}">
                                    ${suspended ? 'Suspended' : 'Active'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <h3 class="section-heading">Account Information</h3>
                    <div class="details-grid">
                        ${details.slice(0, 5).map(([label, value]) => `
                            <div class="detail-item">
                                <div class="detail-label">${escapeHTML(label)}</div>
                                <div class="detail-value">${escapeHTML(value ?? '—')}</div>
                            </div>
                        `).join('')}
                    </div>

                    <h3 class="section-heading">Financial Overview</h3>
                    <div class="details-grid">
                        ${details.slice(5, 10).map(([label, value]) => `
                            <div class="detail-item">
                                <div class="detail-label">${escapeHTML(label)}</div>
                                <div class="detail-value money">${escapeHTML(value ?? '—')}</div>
                            </div>
                        `).join('')}
                    </div>

                    <h3 class="section-heading">Platform Activity</h3>
                    <div class="details-grid">
                        ${details.slice(10).map(([label, value]) => `
                            <div class="detail-item">
                                <div class="detail-label">${escapeHTML(label)}</div>
                                <div class="detail-value">${escapeHTML(value ?? '—')}</div>
                            </div>
                        `).join('')}
                    </div>

                    <p class="form-hint">
                        Only information returned by the backend is displayed.
                        Detailed game, referral, streak, social-task and withdrawal histories
                        can be added through the existing KUDIX history endpoints.
                    </p>`;
            } catch (error) {
                $('previewBody').innerHTML = `
                    <div class="table-state">
                        <i class="bx bx-error-circle"></i>
                        ${escapeHTML(error.message || 'Unable to retrieve this user.')}
                    </div>`;

                console.error('User preview error:', error);
            }
        }

        function openAccountAction(action, id, username) {
            state.action = { action, id, username };

            const suspend = action === 'suspend';

            $('accountModalTitle').textContent = suspend
                ? 'Suspend Account'
                : 'Reactivate Account';

            $('accountModalSubtitle').textContent = suspend
                ? 'Restrict access to this user account.'
                : 'Restore access to this user account.';

            $('accountModalMessage').textContent = suspend
                ? `Are you sure you want to suspend "${username}"? The backend will apply KUDIX's configured account restrictions. The user's recorded balances and transaction history must remain intact.`
                : `Are you sure you want to reactivate "${username}"? Existing Level Up, verification and withdrawal eligibility requirements will still apply.`;

            $('reasonGroup').style.display = suspend ? 'block' : 'none';
            $('suspensionReason').value = '';

            const button = $('confirmAccountAction');
            button.className = `btn ${suspend ? 'btn-red' : 'btn-green'}`;
            button.textContent = suspend ? 'Suspend Account' : 'Reactivate Account';

            openModal('accountModal');
        }

        async function confirmAccountAction() {
            const selection = state.action;

            if (!selection) return;

            const { action, id } = selection;
            const button = $('confirmAccountAction');
            const originalText = button.textContent;

            const reason = $('suspensionReason').value.trim();

            if (action === 'suspend' && !reason) {
                showAlert('Please enter a reason for suspending this account.', 'error');
                $('suspensionReason').focus();
                return;
            }

            button.disabled = true;
            button.textContent = 'Processing...';

            try {
                const result = await apiRequest(
                    action === 'suspend' ? API.suspend : API.reactivate,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            user_id: id,
                            reason: action === 'suspend' ? reason : undefined
                        })
                    }
                );

                closeModal('accountModal');
                state.action = null;

                showAlert(
                    result.message ||
                    (action === 'suspend'
                        ? 'Account suspended successfully.'
                        : 'Account reactivated successfully.')
                );

                await loadUsers();
            } catch (error) {
                showAlert(error.message || 'The account status could not be changed.', 'error');
            } finally {
                button.disabled = false;
                button.textContent = originalText;
            }
        }

        $('confirmAccountAction').addEventListener('click', confirmAccountAction);

        $('usersTableBody').addEventListener('click', event => {
            const button = event.target.closest('button[data-action]');

            if (!button) return;

            const { action, id, username } = button.dataset;

            if (!id) {
                showAlert('Missing user ID. The action cannot proceed.', 'error');
                return;
            }

            if (action === 'preview') {
                previewUser(id);
            } else if (action === 'suspend' || action === 'reactivate') {
                openAccountAction(action, id, username || 'this user');
            }
        });

        let searchTimer;

        $('searchInput').addEventListener('input', () => {
            clearTimeout(searchTimer);

            searchTimer = setTimeout(() => {
                state.search = $('searchInput').value.trim();
                state.page = 1;
                loadUsers();
            }, 350);
        });

        $('statusFilter').addEventListener('change', () => {
            state.status = $('statusFilter').value;
            state.page = 1;
            loadUsers();
        });

        $('typeFilter').addEventListener('change', () => {
            state.accountType = $('typeFilter').value;
            state.page = 1;
            loadUsers();
        });

        $('clearFilters').addEventListener('click', () => {
            $('searchInput').value = '';
            $('statusFilter').value = '';
            $('typeFilter').value = '';

            state.search = '';
            state.status = '';
            state.accountType = '';
            state.page = 1;

            loadUsers();
        });

        $('pageSize').addEventListener('change', () => {
            state.pageSize = Number($('pageSize').value);
            state.page = 1;
            loadUsers();
        });

        $('prevPage').addEventListener('click', () => {
            if (state.page > 1) {
                state.page--;
                loadUsers();
            }
        });

        $('nextPage').addEventListener('click', () => {
            if (state.page < state.totalPages) {
                state.page++;
                loadUsers();
            }
        });

        $('refreshButton').addEventListener('click', loadUsers);

        const sidebar = $('sidebar');
        const sidebarOverlay = $('sidebarOverlay');

        $('sidebarToggle').addEventListener('click', () => {
            const open = sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('show', open);
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                document.querySelectorAll('.modal-backdrop.show').forEach(modal => {
                    modal.classList.remove('show');
                });

                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('show');
            }
        });

        // Initial request. User records must come from the authenticated backend.
        loadUsers();
   