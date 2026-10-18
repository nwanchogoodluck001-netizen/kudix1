
"use strict";

/*
  KUDIX landing-page interactions.

  Public community URLs can be added here.
  Keep private API keys and secrets out of frontend files.
*/
const KUDIX_CONFIG = {
  channels: {
    telegram: "",
    whatsapp: ""
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  const header = document.getElementById("siteHeader");
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const heroSlider = document.getElementById("heroSlider");
  const slides = [...document.querySelectorAll(".hero-slide")];
  const dots = [...document.querySelectorAll(".slide-dot")];
  const prevButton = document.getElementById("prevSlide");
  const nextButton = document.getElementById("nextSlide");
  const currentSlideLabel = document.getElementById("currentSlide");
  const supportToggle = document.getElementById("supportToggle");
  const supportPanel = document.getElementById("supportPanel");
  const supportClose = document.getElementById("supportClose");
  const supportResponse = document.getElementById("supportResponse");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let activeSlide = 0;
  let slideTimer = null;
  let slideStartedAt = 0;
  let slideRemaining = 6000;
  let isPointerInsideSlider = false;
  let pageIsVisible = !document.hidden;

  const SLIDE_INTERVAL = 6000;

  /* LOADING SCREEN */

  function hideLoader() {
    if (!loader) return;

    loader.classList.add("is-hidden");
    document.body.classList.remove("loading");

    window.setTimeout(() => {
      loader.style.display = "none";
    }, 650);
  }

  document.body.classList.add("loading");

  // Always release the overlay, even if another resource takes too long.
  const loaderFailsafe = window.setTimeout(hideLoader, 2500);

  if (document.readyState === "complete") {
    window.requestAnimationFrame(() => {
      window.clearTimeout(loaderFailsafe);
      hideLoader();
    });
  } else {
    window.addEventListener("load", () => {
      window.clearTimeout(loaderFailsafe);
      hideLoader();
    }, { once: true });
  }

  if (reducedMotion.matches) {
    document.getElementById("loaderStatus").textContent = "Almost ready...";
  }

  /* NAVBAR SCROLL STATE */

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 20);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* MOBILE NAVIGATION */

  function setMenuOpen(open) {
    if (!menuToggle || !mobileMenu) return;

    mobileMenu.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu"
    );

    const icon = menuToggle.querySelector("i");
    if (icon) {
      icon.className = open ? "bx bx-x" : "bx bx-menu";
    }
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      setMenuOpen(mobileMenu.hidden);
    });

    mobileMenu.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => setMenuOpen(false));
    });

    document.addEventListener("click", event => {
      if (
        !mobileMenu.hidden &&
        !mobileMenu.contains(event.target) &&
        !menuToggle.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !mobileMenu.hidden) {
        setMenuOpen(false);
        menuToggle.focus();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) setMenuOpen(false);
    });
  }

  /* HERO SLIDESHOW */

  function renderSlide(index) {
    if (!slides.length) return;

    activeSlide = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {
      const isActive = i === activeSlide;
      slide.classList.toggle("active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));

      // Prevent keyboard users from tabbing into hidden slides.
      slide.querySelectorAll("a, button").forEach(element => {
        element.tabIndex = isActive ? 0 : -1;
      });
    });

    dots.forEach((dot, i) => {
      const isActive = i === activeSlide;
      dot.classList.toggle("active", isActive);
      dot.setAttribute("aria-pressed", String(isActive));
    });

    if (currentSlideLabel) {
      currentSlideLabel.textContent = String(activeSlide + 1).padStart(2, "0");
    }
  }

  function stopSlideTimer() {
    if (slideTimer !== null) {
      window.clearTimeout(slideTimer);
      slideTimer = null;
    }
  }

  function scheduleNextSlide(delay = SLIDE_INTERVAL) {
    stopSlideTimer();

    if (
      reducedMotion.matches ||
      document.hidden ||
      isPointerInsideSlider ||
      slides.length < 2
    ) {
      return;
    }

    slideRemaining = delay;
    slideStartedAt = Date.now();

    slideTimer = window.setTimeout(() => {
      renderSlide(activeSlide + 1);
      scheduleNextSlide(SLIDE_INTERVAL);
    }, delay);
  }

  function goToSlide(index) {
    renderSlide(index);
    scheduleNextSlide(SLIDE_INTERVAL);
  }

  if (slides.length) {
    renderSlide(0);
    scheduleNextSlide();

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => goToSlide(index));
    });

    prevButton?.addEventListener("click", () => goToSlide(activeSlide - 1));
    nextButton?.addEventListener("click", () => goToSlide(activeSlide + 1));

    heroSlider?.addEventListener("mouseenter", () => {
      isPointerInsideSlider = true;

      if (slideTimer !== null) {
        const elapsed = Date.now() - slideStartedAt;
        slideRemaining = Math.max(500, slideRemaining - elapsed);
      }

      stopSlideTimer();
    });

    heroSlider?.addEventListener("mouseleave", () => {
      isPointerInsideSlider = false;
      scheduleNextSlide(slideRemaining || SLIDE_INTERVAL);
    });

    heroSlider?.addEventListener("focusin", () => {
      stopSlideTimer();
    });

    heroSlider?.addEventListener("focusout", event => {
      if (!heroSlider.contains(event.relatedTarget)) {
        scheduleNextSlide(SLIDE_INTERVAL);
      }
    });

    // Basic touch swipe support.
    let touchStartX = null;
    let touchStartY = null;

    heroSlider?.addEventListener("touchstart", event => {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    heroSlider?.addEventListener("touchend", event => {
      if (touchStartX === null || touchStartY === null) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY)) {
        goToSlide(deltaX < 0 ? activeSlide + 1 : activeSlide - 1);
      }

      touchStartX = null;
      touchStartY = null;
    }, { passive: true });
  }

  document.addEventListener("visibilitychange", () => {
    pageIsVisible = !document.hidden;

    if (!pageIsVisible) {
      if (slideTimer !== null) {
        const elapsed = Date.now() - slideStartedAt;
        slideRemaining = Math.max(500, slideRemaining - elapsed);
      }
      stopSlideTimer();
    } else {
      scheduleNextSlide(slideRemaining || SLIDE_INTERVAL);
    }
  });

  reducedMotion.addEventListener?.("change", () => {
    if (reducedMotion.matches) {
      stopSlideTimer();
    } else {
      scheduleNextSlide(SLIDE_INTERVAL);
    }
  });

  /* ACTIVE NAVIGATION LINKS */

  const sectionLinks = [...document.querySelectorAll('.desktop-nav .nav-link')];
  const observedSections = sectionLinks
    .map(link => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && observedSections.length) {
    const sectionObserver = new IntersectionObserver(entries => {
      const visibleSections = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (!visibleSections.length) return;

      const activeId = visibleSections[0].target.id;

      sectionLinks.forEach(link => {
        const isActive = link.getAttribute("href") === `#${activeId}`;
        link.classList.toggle("active", isActive);
      });
    }, {
      rootMargin: "-25% 0px -60% 0px",
      threshold: [0, 0.15, 0.35, 0.6]
    });

    observedSections.forEach(section => sectionObserver.observe(section));
  }

  /* SCROLL REVEALS */

  const revealElements = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealElements.forEach(element => revealObserver.observe(element));
  } else {
    revealElements.forEach(element => element.classList.add("is-visible"));
  }

  /* FAQ ACCORDION: KEEP ONE OPEN AT A TIME */

  document.querySelectorAll(".faq-item").forEach(item => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;

      document.querySelectorAll(".faq-item").forEach(other => {
        if (other !== item) other.open = false;
      });
    });
  });

  /* COMMUNITY CHANNELS */

  const channelButtons = document.querySelectorAll("[data-channel]");
  const communityUnavailable = document.getElementById("communityUnavailable");

  let visibleChannelCount = 0;

  channelButtons.forEach(button => {
    const channelName = button.dataset.channel;
    const url = KUDIX_CONFIG.channels[channelName];

    if (isValidPublicChannelUrl(url)) {
      button.href = url;
      button.target = "_blank";
      button.rel = "noopener noreferrer";
      button.hidden = false;
      visibleChannelCount++;
    } else {
      button.hidden = true;
    }
  });

  if (communityUnavailable) {
    communityUnavailable.hidden = visibleChannelCount > 0;
  }

  function isValidPublicChannelUrl(value) {
    if (typeof value !== "string" || !value.trim()) return false;

    try {
      const parsed = new URL(value);
      return (
        parsed.protocol === "https:" &&
        ["t.me", "telegram.me", "whatsapp.com", "chat.whatsapp.com", "wa.me"]
          .includes(parsed.hostname.toLowerCase())
      );
    } catch {
      return false;
    }
  }

  /* SUPPORT WIDGET */

  function setSupportOpen(open) {
    if (!supportPanel || !supportToggle) return;

    supportPanel.hidden = !open;
    supportToggle.classList.toggle("is-open", open);
    supportToggle.setAttribute("aria-expanded", String(open));
    supportToggle.setAttribute(
      "aria-label",
      open ? "Close customer support" : "Open customer support"
    );

    if (open) {
      const firstOption = supportPanel.querySelector("button[data-support-topic]");
      firstOption?.focus();
    }
  }

  supportToggle?.addEventListener("click", () => {
    setSupportOpen(supportPanel.hidden);
  });

  supportClose?.addEventListener("click", () => {
    setSupportOpen(false);
    supportToggle?.focus();
  });

  document.querySelectorAll("[data-support-topic]").forEach(button => {
    button.addEventListener("click", () => {
      const topic = button.dataset.supportTopic;

      const responses = {
        "Game Access": "Game access requires three eligible referrals for restricted games. Check your account progress and the applicable game rules.",
        "Welcome Bonus": "The ₦20,000 welcome reward is promotional gaming credit. It is not withdrawable cash and is subject to the platform's applicable terms.",
        "Referral Issues": "Check that your invited user registered through your referral link and meets the platform's eligibility requirements.",
        "Referral Commission": "The ₦1,000 referral commission applies to successful eligible referrals under the referral rules.",
        "Social Tasks": "Complete the listed task instructions and submit any requested proof. Rewards depend on review and approval.",
        "Account Problems": "For account-specific help, use the official KUDIX support contact once it has been configured.",
        "Speak to a Support Agent": "Direct agent support has not been connected to this frontend yet. Configure an official support channel to enable this option."
      };

      if (!supportResponse) return;

      supportResponse.textContent =
        responses[topic] || "Please check the official KUDIX support information.";

      supportResponse.hidden = false;
    });
  });

  document.addEventListener("click", event => {
    if (
      supportPanel &&
      !supportPanel.hidden &&
      !supportPanel.contains(event.target) &&
      !supportToggle?.contains(event.target)
    ) {
      setSupportOpen(false);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && supportPanel && !supportPanel.hidden) {
      setSupportOpen(false);
      supportToggle?.focus();
    }
  });

  /* FOOTER YEAR */

  const currentYear = document.getElementById("currentYear");
  if (currentYear) currentYear.textContent = new Date().getFullYear();

  /* HANDLE UNAVAILABLE GAME LINKS */

  document.querySelectorAll(".game-link").forEach(link => {
    link.addEventListener("click", event => {
      const destination = link.getAttribute("href");

      // The page is intended to link to the real game pages.
      // If a game page has not yet been created, the browser may show a 404.
      // Replace the destination when the corresponding page is implemented.
      if (!destination) event.preventDefault();
    });
  });
});
