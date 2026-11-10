// Build first. Uses isolated app data and synthetic documents only.
const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const output = mkdtempSync(path.join(os.tmpdir(), "super-note-text-scale-"));
app.setPath("userData", output);
let win, workspace;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = code => win.webContents.executeJavaScript(`(() => { ${code} })()`, true);
async function waitFor(code) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`return ${code}`)) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${code}`);
}
async function openSettings() {
  await evaluate("[...document.querySelectorAll('.menu-left button')].find(el => el.textContent === '设置').click()");
  await waitFor("Boolean(document.querySelector('input[aria-label=\"全局文字缩放\"]'))");
  await win.webContents.insertCSS("*, *::before, *::after { transition: none !important; animation: none !important; } .ant-modal, .ant-modal-mask { opacity: 1 !important; }");
}
async function changeScale(value) {
  await evaluate(`const input = document.querySelector('input[aria-label="全局文字缩放"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${value}');
    input.dispatchEvent(new Event('input', { bubbles: true })); input.blur();`);
  await waitFor(`getComputedStyle(document.documentElement).getPropertyValue('--global-text-scale') === '${value / 100}'`);
  await delay(500);
}
async function sizes() {
  return evaluate(`return Object.fromEntries(['.file-editor', '.tabs-sidebar-item', '.menu-left button', '.settings-row small', '.settings-row .ant-input-number-input', '.ant-modal-title'].map(selector => [selector, parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)]))`);
}
async function verify() {
  ipcMain.handle("workspace:load", () => ({ ok: true, workspace }));
  ipcMain.handle("workspace:saveDelta", (_, payload) => {
    workspace = { ...workspace, ...payload.metadata };
    return { ok: true };
  });
  ipcMain.handle("app:getInfo", () => ({ version: "test", author: "test", desc: "Synthetic fixture" }));
  ipcMain.handle("update:getStatus", () => ({ state: "idle", channel: "latest", currentVersion: "test" }));
  ipcMain.handle("shortcut:getGlobal", () => ({ ok: true, shortcut: "Ctrl+Alt+N" }));
  for (const name of ["app:rendererReady", "app:setLanguage", "tray:syncTabs"]) ipcMain.handle(name, () => ({ ok: true }));
  win = new BrowserWindow({ show: false, width: 1200, height: 800, frame: false,
    webPreferences: { preload: path.resolve(__dirname, "../dist-electron/preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  win.show();
  for (const darkMode of [false, true]) {
    const tab = { id: "fixture", kind: "file", title: "缩放测试", fileName: "fixture.txt", content: "文字缩放 Text scaling\nSecond line", fontSize: 13, dirty: false };
    workspace = { version: 5, savedAt: new Date().toISOString(), tabs: [tab], activeTabId: tab.id, activePane: "pane-main", paneIds: ["pane-main"], paneActiveTabIds: { "pane-main": tab.id }, tabPaneIds: { [tab.id]: ["pane-main"] }, paneWidths: [100], settings: { darkMode, tabLayout: "left" }, recentFiles: [] };
    await win.loadFile(path.resolve(__dirname, "../dist/index.html"));
    await waitFor("Boolean(document.querySelector('.tabs-sidebar-item'))");
    await evaluate("document.querySelector('.tabs-sidebar-item').click()");
    await waitFor("Boolean(document.querySelector('.file-editor'))");
    await openSettings();
    const baseline = await sizes();
    assert.equal(baseline['.file-editor'], 13);
    await changeScale(130);
    const scaled = await sizes();
    for (const selector of Object.keys(baseline)) assert(Math.abs(scaled[selector] - baseline[selector] * 1.3) < .02, `${selector}: ${baseline[selector]} -> ${scaled[selector]}`);
    await delay(750);
    assert.equal(workspace.settings.textScale, 130);
    assert.equal(workspace.tabs[0].fontSize, 13, "Keep document font preferences unchanged");
    for (const width of [1200, 960]) {
      win.setSize(width, 800);
      win.webContents.invalidate();
      await delay(300);
      assert.equal(await evaluate("return document.documentElement.scrollWidth > innerWidth"), false);
      writeFileSync(path.join(output, `${darkMode ? 'dark' : 'light'}-${width}-130.png`), (await win.webContents.capturePage()).toPNG());
    }
    await win.reload();
    await waitFor("Boolean(document.querySelector('.tabs-sidebar-item'))");
    await evaluate("document.querySelector('.tabs-sidebar-item').click()");
    await waitFor("Boolean(document.querySelector('.file-editor'))");
    await waitFor("Math.abs(parseFloat(getComputedStyle(document.querySelector('.file-editor')).fontSize) - 16.9) < .02");
    await openSettings();
    await changeScale(100);
    assert.equal((await sizes())['.file-editor'], 13);
  }
  console.log(JSON.stringify({ scaling130: "passed", settingsPersistence: "passed", reset100: "passed", lightDark: "passed", screenshots: output }));
}
app.whenReady().then(verify).then(() => { win.destroy(); app.exit(0); }).catch(error => { console.error(error.stack); win?.destroy(); app.exit(1); });
setTimeout(() => { console.error("Text scale verification timed out"); app.exit(1); }, 60000).unref();
