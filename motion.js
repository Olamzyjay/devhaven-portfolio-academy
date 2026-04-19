/* Motion system (lightweight)
 * - Scroll reveal with IntersectionObserver
 * - Page load fade-in
 * - Respects prefers-reduced-motion
 */

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function markLoaded() {
  // Let the browser paint once before animating in.
  requestAnimationFrame(() => {
    document.body.classList.add("is-loaded");
  });
}

function addRevealTargets() {
  const targets = [];

  const selectors = [
    ".section-head",
    ".media-frame",
    ".portfolio-tile",
    ".info-tile",
    ".case-card",
    ".proof-card",
    ".insight-card",
    ".course-card",
    ".stack-panel",
    ".contact-panel",
    ".contact-form-shell",
    ".checkout-summary",
    ".checkout-form-shell",
    ".hero-panel"
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(node => targets.push(node));
  });

  // Remove duplicates while keeping order.
  const seen = new Set();
  return targets.filter(node => {
    if (!(node instanceof HTMLElement)) return false;
    if (seen.has(node)) return false;
    seen.add(node);
    return true;
  });
}

function applyStagger(targets) {
  // Stagger per parent "row" if possible.
  const rowMap = new Map();
  targets.forEach(target => {
    const row = target.closest(".row");
    if (row) {
      const list = rowMap.get(row) || [];
      list.push(target);
      rowMap.set(row, list);
    } else {
      // fallback bucket
      const list = rowMap.get(document.body) || [];
      list.push(target);
      rowMap.set(document.body, list);
    }
  });

  rowMap.forEach(list => {
    list.forEach((node, idx) => {
      node.style.setProperty("--reveal-delay", `${Math.min(idx * 70, 280)}ms`);
    });
  });
}

function initReveal() {
  if (prefersReducedMotion()) {
    document.body.classList.add("reduce-motion");
    return;
  }

  const targets = addRevealTargets();
  targets.forEach(node => node.classList.add("reveal"));
  applyStagger(targets);

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // "Mostly visible" threshold; avoid animating things far off-screen.
    return rect.top < vh * 0.92 && rect.bottom > 0;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      // Defer to the next frame so the transition reliably runs.
      requestAnimationFrame(() => el.classList.add("is-visible"));
      observer.unobserve(el);
    });
  }, { root: null, threshold: 0.12, rootMargin: "0px 0px -10% 0px" });

  // Observe after styles are applied, otherwise first paint may skip transitions.
  requestAnimationFrame(() => {
    targets.forEach(node => observer.observe(node));
  });

  // Animate above-the-fold elements shortly after load (so it's visible).
  setTimeout(() => {
    targets.forEach(el => {
      if (el.classList.contains("is-visible")) return;
      if (!isInViewport(el)) return;
      el.classList.add("is-visible");
    });
  }, 120);
}

function initMotion() {
  markLoaded();
  initReveal();
}

document.addEventListener("DOMContentLoaded", initMotion);
