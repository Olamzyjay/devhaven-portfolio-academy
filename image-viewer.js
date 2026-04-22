/* Image Viewer (Bootstrap modal)
 * Any element with [data-image-viewer] will open the modal.
 * Provide:
 * - data-image-src="assets/images/..."
 * - data-image-alt="..."
 */

function initImageViewer() {
  const modalEl = document.getElementById("imageViewerModal");
  const imgEl = document.getElementById("imageViewerImg");
  const titleEl = document.getElementById("imageViewerTitle");
  const dlEl = document.getElementById("imageViewerDownload");
  const openEl = document.getElementById("imageViewerOpen");

  if (!modalEl || !imgEl || !dlEl || !openEl || !window.bootstrap) {
    return;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  function setImage(src, alt) {
    const safeSrc = String(src || "").trim();
    const safeAlt = String(alt || "").trim() || "Image preview";

    imgEl.src = safeSrc;
    imgEl.alt = safeAlt;
    if (titleEl) {
      titleEl.textContent = safeAlt;
    }
    dlEl.href = safeSrc;
    dlEl.setAttribute("download", "");
    openEl.href = safeSrc;
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-image-viewer]");
    if (!trigger) return;

    const src = trigger.getAttribute("data-image-src") || trigger.querySelector("img")?.getAttribute("src");
    const alt = trigger.getAttribute("data-image-alt") || trigger.querySelector("img")?.getAttribute("alt");

    if (!src) return;
    setImage(src, alt);
    modal.show();
  });
}

document.addEventListener("DOMContentLoaded", initImageViewer);

