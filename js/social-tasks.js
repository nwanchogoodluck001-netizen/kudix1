document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const menuButton = document.getElementById("menuButton");
    const themeToggle = document.getElementById("themeToggle");

    const proofModal = document.getElementById("proofModal");
    const closeModal = document.getElementById("closeModal");
    const cancelModal = document.getElementById("cancelModal");
    const proofForm = document.getElementById("proofForm");
    const selectedTask = document.getElementById("selectedTask");
    const proofFile = document.getElementById("proofFile");
    const fileLabel = document.getElementById("fileLabel");
    const proofPreview = document.getElementById("proofPreview");

    const taskSearch = document.getElementById("taskSearch");
    const taskCards = [...document.querySelectorAll(".task-card")];
    const filterButtons = [...document.querySelectorAll(".filter-button")];
    const taskList = document.getElementById("taskList");
    const emptyState = document.getElementById("emptyState");
    const submissionList = document.getElementById("submissionList");
    const submissionEmpty = document.getElementById("submissionEmpty");
    const toast = document.getElementById("toast");

    let activeFilter = "all";
    let toastTimeout;
    let previewUrl = null;
    let selectedFile = null;

    // Current year
    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    // Theme preference
    try {
        const savedTheme = localStorage.getItem("kudix-social-theme");
        if (savedTheme === "light") {
            body.classList.add("light-theme");
        }
    } catch (error) {
        // Theme still works if browser storage is unavailable.
    }

    updateThemeIcon();

    themeToggle.addEventListener("click", () => {
        body.classList.toggle("light-theme");

        try {
            localStorage.setItem(
                "kudix-social-theme",
                body.classList.contains("light-theme") ? "light" : "dark"
            );
        } catch (error) {
            // Ignore unavailable browser storage.
        }

        updateThemeIcon();
    });

    function updateThemeIcon() {
        const icon = themeToggle.querySelector("i");

        if (body.classList.contains("light-theme")) {
            icon.className = "bx bx-sun";
            themeToggle.setAttribute("aria-label", "Switch to dark theme");
        } else {
            icon.className = "bx bx-moon";
            themeToggle.setAttribute("aria-label", "Switch to light theme");
        }
    }

    // Mobile sidebar
    function openSidebar() {
        sidebar.classList.add("open");
        overlay.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
        document.body.style.overflow = "";
    }

    menuButton.addEventListener("click", () => {
        if (sidebar.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeSidebar();
            closeProofModal();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) {
            closeSidebar();
        }
    });

    // Toast notification
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 3500);
    }

    // Task search and category filters
    function filterTasks() {
        const searchTerm = taskSearch.value.trim().toLowerCase();
        let visibleCount = 0;

        taskCards.forEach((card) => {
            const category = card.dataset.category || "";
            const searchContent = (
                (card.dataset.search || "") + " " + card.textContent
            ).toLowerCase();

            const matchesCategory =
                activeFilter === "all" || category === activeFilter;

            const matchesSearch = searchContent.includes(searchTerm);
            const visible = matchesCategory && matchesSearch;

            card.hidden = !visible;

            if (visible) visibleCount++;
        });

        emptyState.hidden = visibleCount !== 0;
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;

            filterButtons.forEach((item) => {
                const isActive = item === button;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", String(isActive));
            });

            filterTasks();
        });

        button.setAttribute(
            "aria-pressed",
            String(button.classList.contains("active"))
        );
    });

    taskSearch.addEventListener("input", filterTasks);

    // Task destination buttons
    // Connect real, approved task URLs here when they are available.
    document.querySelectorAll(".do-task").forEach((button) => {
        button.addEventListener("click", () => {
            const taskName = button.dataset.task;

            showToast(
                `“${taskName}”: task destination not configured yet. Add the official task URL before publishing.`
            );
        });
    });

    // Open proof modal
    document.querySelectorAll(".upload-task").forEach((button) => {
        button.addEventListener("click", () => {
            selectedTask.value = button.dataset.task;
            proofForm.reset();
            selectedFile = null;
            clearPreview();
            fileLabel.textContent = "Click to choose an image";

            proofModal.classList.add("open");
            proofModal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";

            setTimeout(() => selectedTask.focus(), 50);
        });
    });

    function closeProofModal() {
        proofModal.classList.remove("open");
        proofModal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        proofForm.reset();
        selectedFile = null;
        clearPreview();
        fileLabel.textContent = "Click to choose an image";
    }

    function clearPreview() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        proofPreview.removeAttribute("src");
        proofPreview.hidden = true;
    }

    closeModal.addEventListener("click", closeProofModal);
    cancelModal.addEventListener("click", closeProofModal);

    proofModal.addEventListener("click", (event) => {
        if (event.target === proofModal) {
            closeProofModal();
        }
    });

    // Validate and preview selected image
    proofFile.addEventListener("change", () => {
        const file = proofFile.files[0];

        selectedFile = null;
        clearPreview();

        if (!file) {
            fileLabel.textContent = "Click to choose an image";
            return;
        }

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            proofFile.value = "";
            fileLabel.textContent = "Click to choose an image";
            showToast("Please select a PNG, JPG, or WEBP image.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            proofFile.value = "";
            fileLabel.textContent = "Click to choose an image";
            showToast("The image must be 5 MB or smaller.");
            return;
        }

        selectedFile = file;
        previewUrl = URL.createObjectURL(file);

        proofPreview.src = previewUrl;
        proofPreview.hidden = false;
        fileLabel.textContent = file.name;
    });

    // Save a local-only demo submission
    proofForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!selectedTask.value.trim()) {
            showToast("Please select a task first.");
            return;
        }

        if (!selectedFile || !previewUrl) {
            showToast("Please choose a screenshot before submitting.");
            return;
        }

        const taskName = selectedTask.value.trim();
        const file = selectedFile;
        const localImageUrl = previewUrl;

        // Transfer ownership of this preview URL to the submission item.
        previewUrl = null;
        selectedFile = null;

        addSubmission(taskName, file, localImageUrl);
        closeProofModal();

        showToast(
            "Demo submission saved in this page. It has not been sent for review."
        );
    });

    function addSubmission(taskName, file, imageUrl) {
        submissionEmpty.hidden = true;

        const item = document.createElement("article");
        item.className = "submission-item";

        const image = document.createElement("img");
        image.className = "submission-thumb";
        image.src = imageUrl;
        image.alt = "Selected screenshot proof";

        const details = document.createElement("div");
        details.className = "submission-details";

        const title = document.createElement("strong");
        title.textContent = taskName;

        const time = document.createElement("small");
        time.textContent = `Saved locally · ${new Date().toLocaleString()}`;

        details.append(title, time);

        const status = document.createElement("span");
        status.className = "status-pending";
        status.textContent = "Demo";

        item.append(image, details, status);
        submissionList.prepend(item);

        // Release the temporary image when its submission is removed.
        item.addEventListener("DOMNodeRemoved", () => {
            URL.revokeObjectURL(imageUrl);
        }, { once: true });

        // Keep the demo interface from growing without limit.
        const submissions = submissionList.querySelectorAll(".submission-item");

        if (submissions.length > 8) {
            const oldest = submissions[submissions.length - 1];
            const oldImage = oldest.querySelector("img");

            if (oldImage && oldImage.src.startsWith("blob:")) {
                URL.revokeObjectURL(oldImage.src);
            }

            oldest.remove();
        }
    }

    // The page has no connected authentication system.
    document.getElementById("logoutButton").addEventListener("click", () => {
        showToast(
            "Demo page only: connect your authentication system before enabling logout."
        );
    });
});