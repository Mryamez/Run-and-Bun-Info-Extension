(function () {
  if (window.__rnbDexLoaded) return;
  window.__rnbDexLoaded = true;

  let showButton = true;
  try {
    chrome.storage.sync.get({ showButton: true }, (v) => (showButton = v.showButton));
    chrome.storage.onChanged.addListener((c) => { if (c.showButton) showButton = c.showButton.newValue; });
  } catch (_) {}

  // Everything lives in a shadow root so page styles can't break it.
  const host = document.createElement("div");
  host.id = "rnb-dex-host";
  host.style.cssText = "all:initial;position:absolute;top:0;left:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    ${RNB.CSS}
    .btn{position:absolute;display:none;width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;
      background:#e3350d;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3);padding:0}
    .btn:hover{background:#c22b08}
    .panel{position:absolute;display:none;width:340px;max-width:calc(100vw - 24px);max-height:70vh;overflow:auto;
      background:#f3f4f6;border:1px solid #c4c8cf;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);}
    .bar{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;cursor:move;
      background:#e3350d;color:#fff;font:600 12px system-ui,sans-serif;border-radius:11px 11px 0 0;position:sticky;top:0;user-select:none}
    .x{background:none;border:none;color:#fff;font:700 16px system-ui,sans-serif;cursor:pointer;padding:0 2px;line-height:1}
    .body{padding:8px}
  </style>
  <button class="btn" title="Run & Bun Dex lookup">?</button>
  <div class="panel"><div class="bar"><span>Run & Bun Dex · Gen 8</span><button class="x" title="Close (Esc)">×</button></div><div class="body"></div></div>`;
  const btn = root.querySelector(".btn");
  const panel = root.querySelector(".panel");
  const body = root.querySelector(".body");

  function attach() { if (!host.isConnected) document.documentElement.appendChild(host); }

  let pending = null; // {text, rect}

  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      // Text inside <input>/<textarea>
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && a.selectionStart !== a.selectionEnd) {
        try {
          return { text: a.value.slice(a.selectionStart, a.selectionEnd), rect: a.getBoundingClientRect() };
        } catch (_) {}
      }
      return null;
    }
    const text = sel.toString();
    const rects = sel.getRangeAt(0).getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : sel.getRangeAt(0).getBoundingClientRect();
    return { text, rect };
  }

  function hideButton() { btn.style.display = "none"; }
  function hidePanel() { panel.style.display = "none"; }

  function placeAt(el, rect, dx, dy) {
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = rect.right + dx, y = rect.bottom + dy;
    x = Math.min(x, window.innerWidth - w - 12);
    if (y + h > window.innerHeight - 8) y = Math.max(8, rect.top - h - 6);
    el.style.left = Math.max(8, x) + window.scrollX + "px";
    el.style.top = y + window.scrollY + "px";
  }

  function render(text) {
    const hits = RNB.find(text);
    if (hits.length) {
      body.innerHTML = hits.map(RNB.cardHTML).join("");
    } else {
      const sugg = RNB.suggest(text);
      body.innerHTML = `<div class="empty">No move, ability or item called “${RNB.esc(text.trim().slice(0, 40))}”.` +
        (sugg.length ? ` Did you mean:</div><div class="sugg">${sugg.map((s, i) =>
          `<button data-i="${i}">${RNB.esc(s.e.n)} <span style="color:#6b7280">(${s.label})</span></button>`).join("")}</div>` : "</div>");
      body.querySelectorAll(".sugg button").forEach((b) =>
        b.addEventListener("click", () => { body.innerHTML = RNB.cardHTML(sugg[+b.dataset.i]); }));
    }
  }

  function openPanel(text, rect) {
    attach();
    hideButton();
    render(text);
    panel.style.display = "block";
    body.scrollTop = 0;
    placeAt(panel, rect || { right: window.innerWidth / 2 - 170, bottom: 80, top: 80 }, -20, 8);
  }

  document.addEventListener("mouseup", (ev) => {
    if (ev.composedPath().includes(host)) return;
    setTimeout(() => {
      const info = selectionInfo();
      if (!info || !showButton) return hideButton();
      const t = info.text.trim();
      if (t.length < 3 || t.length > 60 || !RNB.find(t).length) return hideButton();
      pending = info;
      attach();
      btn.style.display = "block";
      placeAt(btn, info.rect, 4, 4);
    }, 0);
  }, true);

  document.addEventListener("mousedown", (ev) => {
    if (ev.composedPath().includes(host)) return;
    hideButton();
    hidePanel();
  }, true);

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { hideButton(); hidePanel(); }
  }, true);

  btn.addEventListener("mousedown", (ev) => ev.preventDefault()); // keep the selection
  btn.addEventListener("click", () => pending && openPanel(pending.text, pending.rect));
  root.querySelector(".x").addEventListener("click", hidePanel);

  // Drag the panel by its header.
  const bar = root.querySelector(".bar");
  bar.addEventListener("mousedown", (ev) => {
    if (ev.target.closest(".x")) return;
    ev.preventDefault();
    const sx = ev.clientX - panel.offsetLeft, sy = ev.clientY - panel.offsetTop;
    const move = (e) => { panel.style.left = e.clientX - sx + "px"; panel.style.top = e.clientY - sy + "px"; };
    const up = () => { window.removeEventListener("mousemove", move, true); window.removeEventListener("mouseup", up, true); };
    window.addEventListener("mousemove", move, true);
    window.addEventListener("mouseup", up, true);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "rnb-lookup") {
      const info = selectionInfo();
      openPanel(msg.text, info && info.rect);
    } else if (msg.type === "rnb-lookup-selection") {
      const info = selectionInfo();
      if (info && info.text.trim()) openPanel(info.text, info.rect);
    }
  });
})();
