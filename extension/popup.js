const style = document.createElement("style");
style.textContent = RNB.CSS;
document.head.appendChild(style);

const q = document.getElementById("q");
const results = document.getElementById("results");

q.addEventListener("input", () => {
  const text = q.value.trim();
  if (text.length < 2) { results.innerHTML = ""; return; }
  let hits = RNB.find(text);
  if (!hits.length) hits = RNB.suggest(text, 6);
  results.innerHTML = hits.length ? hits.map(RNB.cardHTML).join("") : `<div class="empty">No matches.</div>`;
});

document.getElementById("general").innerHTML =
  RNB_DEX.general.map((g) => `<li>${RNB.esc(g)}</li>`).join("");

const box = document.getElementById("showButton");
chrome.storage.sync.get({ showButton: true }, (v) => (box.checked = v.showButton));
box.addEventListener("change", () => chrome.storage.sync.set({ showButton: box.checked }));
