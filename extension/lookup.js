// Shared lookup + rendering, used by the content script and the toolbar popup.
var RNB = (function () {
  const KINDS = [["moves", "Move"], ["abilities", "Ability"], ["items", "Item"]];
  const toId = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  function exact(id) {
    const out = [];
    for (const [kind, label] of KINDS) {
      const e = RNB_DEX[kind][id];
      if (e) out.push({ kind, label, id, e });
    }
    return out;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // Finds entries in the text. Tries the whole text, then shorter word runs
  // (so "used Close Combat!" finds Close Combat), longest first.
  function find(text) {
    text = (text || "").trim();
    if (!text || text.length > 80) return [];
    const whole = exact(toId(text));
    if (whole.length) return whole;
    const words = text.split(/[\s,;:!?()\[\]\/|]+/).filter(Boolean).slice(0, 12);
    const found = [], seen = new Set();
    for (let len = Math.min(words.length, 4); len >= 1; len--) {
      for (let i = 0; i + len <= words.length; i++) {
        const id = toId(words.slice(i, i + len).join(" "));
        if (id.length < 3 || seen.has(id)) continue;
        for (const hit of exact(id)) {
          if (!found.some((f) => f.label + f.id === hit.label + hit.id)) found.push(hit);
        }
        seen.add(id);
      }
      if (found.length) return found;
    }
    return found;
  }

  function suggest(text, limit = 5) {
    const id = toId(text || "");
    if (id.length < 3) return [];
    const max = id.length < 6 ? 1 : 2;
    const scored = [];
    for (const [kind, label] of KINDS) {
      for (const key in RNB_DEX[kind]) {
        let d = key.startsWith(id) ? 0.5 : lev(id, key, max);
        if (d <= max) scored.push({ kind, label, id: key, e: RNB_DEX[kind][key], d });
      }
    }
    return scored.sort((a, b) => a.d - b.d || a.id.length - b.id.length).slice(0, limit);
  }

  const TYPE_COLORS = {
    Normal: "#9a9a6e", Fire: "#e0702a", Water: "#5a82e6", Electric: "#d6b414", Grass: "#5fae3c",
    Ice: "#6ec4c4", Fighting: "#b02d26", Poison: "#93399a", Ground: "#c9a54e", Flying: "#8d76e6",
    Psychic: "#e8457a", Bug: "#97a51d", Rock: "#a8912f", Ghost: "#6a5590", Dragon: "#6230f0",
    Dark: "#6a5446", Steel: "#9e9ebc", Fairy: "#d97fa0", "???": "#68a090",
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function cardHTML(hit) {
    const e = hit.e;
    let meta = "";
    if (hit.kind === "moves") {
      const acc = e.acc === true ? "—" : e.acc + "%";
      const pri = e.pri ? (e.pri > 0 ? "+" : "") + e.pri : "0";
      meta = `<div class="badges">
          <span class="type" style="background:${TYPE_COLORS[e.t] || "#777"}">${esc(e.t)}</span>
          <span class="cat cat-${esc(e.c.toLowerCase())}">${esc(e.c)}</span>
        </div>
        <table class="stats"><tr><th>Power</th><th>Acc</th><th>PP</th><th>Priority</th></tr>
          <tr><td>${e.bp || "—"}</td><td>${acc}</td><td>${e.pp}</td><td>${pri}</td></tr></table>
        <div class="small">Target: ${esc(e.tg)}${e.fl.length ? " · " + e.fl.map(esc).join(" · ") : ""}</div>`;
    } else if (hit.kind === "items" && (e.fling || e.ng)) {
      const parts = [];
      if (e.fling) parts.push(`Fling: ${e.fling} BP`);
      if (e.ng) parts.push(`Natural Gift: ${e.ng[1]} ${e.ng[0]} BP`);
      meta = `<div class="small">${parts.map(esc).join(" · ")}</div>`;
    }
    const desc = e.d && e.d !== e.sd ? e.d : "";
    return `<div class="card">
      <div class="head"><span class="name">${esc(e.n)}</span><span class="kind">${hit.label}</span></div>
      ${meta}
      ${e.rb ? `<div class="rnb">${esc(e.rb)}</div>` : ""}
      <div class="sd">${esc(e.sd || e.d || "No description.")}</div>
      ${desc ? `<details><summary>Full Gen 8 details</summary><div class="desc">${esc(desc)}</div></details>` : ""}
      ${e.newer ? `<div class="small warn">Not in Sword/Shield — may not exist in Run & Bun.</div>` : ""}
    </div>`;
  }

  const CSS = `
    .card{font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d1f24;background:#fff;
      border:1px solid #d5d8de;border-radius:10px;padding:10px 12px;margin:0 0 8px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
    .card:last-child{margin-bottom:0}
    .head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px}
    .name{font-weight:700;font-size:15px}
    .kind{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280}
    .badges{display:flex;gap:6px;margin-bottom:6px}
    .type,.cat{font-size:11px;font-weight:600;color:#fff;border-radius:4px;padding:1px 7px}
    .cat-physical{background:#c0392b}.cat-special{background:#2e5aac}.cat-status{background:#7b8088}
    .stats{border-collapse:collapse;width:100%;margin-bottom:6px;text-align:center}
    .stats th{font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;padding:0 2px}
    .stats td{font-weight:700;font-size:14px;padding:0 2px}
    .small{font-size:11.5px;color:#4b5563;margin-bottom:6px}
    .warn{color:#9a5b00;margin:6px 0 0}
    .rnb{background:#fff4d6;border-left:3px solid #e0a400;padding:5px 8px;border-radius:4px;margin-bottom:6px;font-weight:600}
    .sd{margin-bottom:2px}
    details{margin-top:4px}summary{cursor:pointer;color:#2e5aac;font-size:12px}
    .desc{margin-top:4px;color:#374151}
    .empty{font:13px/1.45 system-ui,sans-serif;color:#374151;padding:4px 2px}
    .sugg{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .sugg button{font:12px system-ui,sans-serif;border:1px solid #c9ccd3;background:#f6f7f9;border-radius:999px;padding:3px 10px;cursor:pointer;color:#1d1f24}
    .sugg button:hover{background:#e9ecf1}
  `;

  return { find, suggest, cardHTML, CSS, esc, toId };
})();
