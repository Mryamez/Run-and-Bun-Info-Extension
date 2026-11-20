chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rnb-lookup",
    title: "Run & Bun Dex: look up \"%s\"",
    contexts: ["selection"],
  });
});

function send(tabId, frameId, text) {
  chrome.tabs.sendMessage(tabId, { type: "rnb-lookup", text }, { frameId }).catch(() => {});
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rnb-lookup" && tab) send(tab.id, info.frameId || 0, info.selectionText);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "lookup-selection" || !tab) return;
  // No selection text here: each frame's content script reads its own selection.
  chrome.tabs.sendMessage(tab.id, { type: "rnb-lookup-selection" }).catch(() => {});
});
