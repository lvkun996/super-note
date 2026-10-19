// Build first, then run: electron scripts/verify-app-controllers.cjs
// Actual renderer/preload with isolated app data and mocked file IPC.
const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

app.setPath("userData", mkdtempSync(path.join(os.tmpdir(), "super-note-controllers-")));
app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const tab = (id, content) => ({ id, kind: "file", title: `${id}.txt`, fileName: `${id}.txt`, content, fontSize: 13, themeIndex: 0, dirty: false });
const source = {
  version: 5, savedAt: "2026-10-19T00:00:00.000Z", activeTabId: "first", activePane: "pane-main",
  paneIds: ["pane-main"], paneActiveTabIds: { "pane-main": "first" },
  tabPaneIds: { first: ["pane-main"], second: ["pane-main"] }, paneWidths: [100], splitView: false,
  settings: { tabLayout: "left", sidebarVisible: true, language: "zh-CN" },
  tabs: [tab("first", "original"), tab("second", "another document")], recentFiles: [],
};
let win, saved, filePayload, failSave = false, flushed = false;
const errors = [];
const evaluate = code => win.webContents.executeJavaScript(`{ ${code} }`, true);
async function waitFor(code) {
  for (let i = 0; i < 120; i++) {
    if (await evaluate(code)) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${code}`);
}
async function key(key, modifiers = ["control"]) {
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, ctrlKey: ${modifiers.includes("control")}, shiftKey: ${modifiers.includes("shift")}, bubbles: true }))`);
  await delay(80);
}
const value = () => evaluate("document.querySelector('.file-editor')?.value");
async function verify() {
  ipcMain.handle("workspace:load", async () => { await delay(150); return { ok: true, workspace: source }; });
  ipcMain.handle("workspace:save", (_, workspace) => { saved = workspace; return { ok: true }; });
  ipcMain.handle("file:save", (_, payload) => {
    filePayload = payload;
    if (failSave) return { ok: false, error: "Synthetic failure" };
    return { ok: true, path: `C:\\synthetic\\${payload.defaultName}`, name: payload.defaultName, content: payload.content, mtimeMs: 123, size: payload.content.length };
  });
  ipcMain.handle("file:getSnapshots", () => []);
  ipcMain.handle("app:getInfo", () => ({ version: "test", author: "test", desc: "Synthetic fixture" }));
  ipcMain.handle("update:getStatus", () => ({ state: "idle", channel: "latest", currentVersion: "test" }));
  for (const name of ["app:rendererReady", "app:setLanguage", "tray:syncTabs"]) ipcMain.handle(name, () => ({ ok: true }));
  ipcMain.handle("app:workspaceFlushed", () => { flushed = true; return { ok: true }; });
  win = new BrowserWindow({ show: false, width: 1000, height: 700, webPreferences: {
    preload: path.resolve(__dirname, "../dist-electron/preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false,
  } });
  win.webContents.on("console-message", event => { if (event.level === "error") errors.push(event.message); });
  await win.loadFile(path.resolve(__dirname, "../dist/index.html"));
  await waitFor("document.querySelectorAll('.tabs-sidebar-item').length === 2");
  await evaluate("document.querySelector('.tabs-sidebar-item').click()");
  await waitFor("Boolean(document.querySelector('.file-editor'))");
  assert.equal(await value(), "original");
  await delay(700);
  assert.equal(saved.tabs.length, 2, "Hydration must not be overwritten by the initial blank tab");

  await evaluate("const e=document.querySelector('.file-editor'); e.focus(); e.setSelectionRange(e.value.length,e.value.length)");
  await win.webContents.insertText(" changed");
  await waitFor("document.querySelector('.file-editor').value === 'original changed'");
  await key("z");
  assert.equal(await value(), "original", "Undo routed through the extracted history hook");
  await key("y");
  assert.equal(await value(), "original changed", "Redo restores the edited text");
  await key("s");
  assert.equal(filePayload.content, "original changed");
  assert.equal(filePayload.requiredExtension, "txt");
  await delay(700);
  assert.equal(saved.tabs.find(t => t.id === "first").dirty, false);

  await key("t");
  await waitFor("document.querySelectorAll('.tabs-sidebar-item').length === 3");
  await win.webContents.insertText("draft");
  await waitFor("document.querySelector('.file-editor').value === 'draft'");
  failSave = true;
  await key("s");
  await delay(700);
  assert.equal(saved.tabs.find(t => t.content === "draft").dirty, true, "Failed save must retain the unsaved draft");
  failSave = false;
  await key("s");
  await key("q");
  await waitFor("document.querySelectorAll('.tabs-sidebar-item').length === 2");
  assert.equal(await value(), "original changed", "Closing a tab returns to the previously visited tab");

  await key("f");
  await waitFor("Boolean(document.querySelector('#global-search-input'))");
  await key("Escape", []);
  await waitFor("!document.querySelector('#global-search-input')");
  await key("b");
  await waitFor("document.querySelector('.app-content-shell').classList.contains('sidebar-collapsed')");
  await key("b");
  await waitFor("!document.querySelector('.app-content-shell').classList.contains('sidebar-collapsed')");

  // Quit immediately after typing, before the debounce interval elapses.
  await evaluate("const e=document.querySelector('.file-editor');e.focus();e.setSelectionRange(e.value.length,e.value.length)");
  await win.webContents.insertText(" final");
  await waitFor("document.querySelector('.file-editor').value.endsWith(' final')");
  win.webContents.send("app:prepareQuit");
  for (let i = 0; !flushed && i < 100; i++) await delay(20);
  assert(flushed, "Prepare-quit must acknowledge the save");
  assert.equal(saved.tabs.find(t => t.id === "first").content, "original changed final");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ hydration: "passed", undoRedo: "passed", fileSaveAndFailure: "passed", tabCreateCloseHistory: "passed", shortcutsAndEscape: "passed", quitFlush: "passed", rendererErrors: errors }));
}
app.whenReady().then(verify).then(() => { win?.destroy(); app.exit(0); }).catch(error => {
  console.error(error.stack);
  if (errors.length) console.error(JSON.stringify(errors));
  win?.destroy(); app.exit(1);
});
setTimeout(() => { console.error("Controller verification timed out"); app.exit(1); }, 45000).unref();

