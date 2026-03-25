chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'THEME_CHANGE') {
    const suffix = message.isDark ? '-dark' : '';
    chrome.action.setIcon({
      path: {
        "16": `icons/16${suffix}.png`,
        "32": `icons/32${suffix}.png`,
        "48": `icons/48${suffix}.png`,
        "128": `icons/128${suffix}.png`
      }
    });
  }
});