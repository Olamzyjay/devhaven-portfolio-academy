async function askAI() {
  const promptEl = document.getElementById("prompt");
  const outEl = document.getElementById("aiOutput");
  const btn = document.getElementById("askAiBtn");

  if (!promptEl || !outEl) return;

  const message = String(promptEl.value || "").trim();
  if (!message) {
    outEl.textContent = "Type a question first.";
    return;
  }

  const setBusy = busy => {
    if (btn) btn.disabled = !!busy;
    promptEl.disabled = !!busy;
  };

  setBusy(true);
  outEl.textContent = "Thinking...";

  try {
    const res = await fetch("/.netlify/functions/ask-openai", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const err = data?.error || data?.message || raw || `HTTP ${res.status}`;
      outEl.textContent = `Error: ${String(err)}`;
      return;
    }

    // Responses API typically includes `output_text` (string). Fallback to showing JSON.
    const text = (data && typeof data.output_text === "string") ? data.output_text.trim() : "";
    outEl.textContent = text || JSON.stringify(data, null, 2);
  } catch (err) {
    outEl.textContent = `Error: ${String(err?.message || err)}`;
  } finally {
    setBusy(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("askAiBtn");
  if (!btn) return;
  btn.addEventListener("click", askAI);
});

