/* Edit this file with your real details before deploying. */

window.DEVHavenProfile = {
  // Your display name (shows on the portfolio + resume pages)
  name: "Olamide Joshua Olawuyi",

  // Optional: a short line under your name or in intro sections
  tagline: "CEO | Developer | Website Designer | Digital Skills Trainer",

  // Social links (leave "" to hide a platform)
  socials: {
    facebook: "https://www.facebook.com/profile.php?id=61582940563204",
    github: "https://github.com/Olamzyjay",
    linkedin: ""
  }
};

function applyProfile() {
  const profile = window.DEVHavenProfile || {};

  const name = String(profile.name || "").trim();
  if (name) {
    document.querySelectorAll("[data-profile-name]").forEach(node => {
      node.textContent = name;
    });
  }

  const tagline = String(profile.tagline || "").trim();
  if (tagline) {
    document.querySelectorAll("[data-profile-tagline]").forEach(node => {
      node.textContent = tagline;
    });
  }

  const socials = profile.socials && typeof profile.socials === "object" ? profile.socials : {};
  const socialMap = {
    facebook: String(socials.facebook || "").trim(),
    github: String(socials.github || "").trim(),
    linkedin: String(socials.linkedin || "").trim()
  };

  Object.entries(socialMap).forEach(([key, url]) => {
    document.querySelectorAll(`[data-social-${key}]`).forEach(node => {
      if (!(node instanceof HTMLAnchorElement)) return;
      if (!url) {
        node.classList.add("d-none");
        node.setAttribute("aria-hidden", "true");
        node.setAttribute("tabindex", "-1");
        node.removeAttribute("href");
        return;
      }
      node.classList.remove("d-none");
      node.removeAttribute("aria-hidden");
      node.removeAttribute("tabindex");
      node.href = url;
    });
  });

  // Hide the "replace links" note once at least one social link exists.
  const anySocial = Object.values(socialMap).some(Boolean);
  document.querySelectorAll("[data-social-note]").forEach(node => {
    if (anySocial) {
      node.classList.add("d-none");
    } else {
      node.classList.remove("d-none");
    }
  });
}

document.addEventListener("DOMContentLoaded", applyProfile);
