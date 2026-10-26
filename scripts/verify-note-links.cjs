// Run after the frontend build. Uses synthetic notes, isolated app data and mocked OS file opening.
const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ts = require("typescript");
app.setPath("userData", mkdtempSync(path.join(os.tmpdir(), "super-note-note-links-")));
app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const note = (id, content, markdown = false) => ({ id, kind: "file", title: id, fileName: `${id}.${markdown ? "md" : "txt"}`, content, fontSize: 13, themeIndex: 0, dirty: false });
let workspace, win, saved, shortcut = "Ctrl+Alt+Space";
const opened = [], errors = [];
const evaluate = code => win.webContents.executeJavaScript(`{ ${code} }`, true).catch(error => { throw new Error(`${code}: ${error.message}`); });
async function waitFor(code) {
  for (let i = 0; i < 120; i++) { if (await evaluate(code)) return; await delay(40); }
  throw new Error(`Timed out: ${code}`);
}
async function key(keyCode, modifiers = []) {
  for (const type of ["keyDown", "keyUp"]) win.webContents.sendInputEvent({ type, keyCode, modifiers });
  await delay(65);
}
async function selectNote(id) {
  await evaluate(`document.querySelector('.tabs-sidebar-item[data-tab-id="${id}"]').click()`);
  await waitFor(`document.querySelector('.file-view[data-tab-id="${id}"]')`);
}
async function load(content, markdown = false) {
  workspace = { version: 5, savedAt: new Date().toISOString(), activeTabId: "first", activePane: "pane-main", paneIds: ["pane-main"], paneActiveTabIds: { "pane-main": "first" }, tabPaneIds: { first: ["pane-main"], second: ["pane-main"], third: ["pane-main"] }, paneWidths: [100], splitView: false, settings: { tabLayout: "left", language: "zh-CN" }, tabs: [note("first", content, markdown), note("second", "Second note"), note("third", "Third note")], recentFiles: [] };
  saved = undefined;
  await win.loadFile(path.resolve(__dirname, "../dist/index.html"));
  await waitFor("document.querySelectorAll('.tabs-sidebar-item').length === 3");
  await selectNote("first");
  if (markdown) { await waitFor("document.querySelector('.file-title-edit')"); await evaluate("document.querySelector('.file-title-edit').click()"); }
  await waitFor("document.querySelector('.file-editor')");
  await evaluate("const e=document.querySelector('.file-editor'); e.focus(); e.setSelectionRange(e.value.length,e.value.length)");
}
async function clickPath(modifiers = [], button = "left") {
  const point = await evaluate(`const span=document.querySelector('.file-highlight .text-http-link');const r=document.createRange();r.selectNodeContents(span);r.setStart(span.firstChild,5);r.setEnd(span.firstChild,6);const b=r.getBoundingClientRect();({x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)})`);
  win.webContents.sendInputEvent({ type: "mouseDown", ...point, button, clickCount: 1, modifiers });
  win.webContents.sendInputEvent({ type: "mouseUp", ...point, button, clickCount: 1, modifiers });
  await delay(100);
}
async function verify() {
  ipcMain.handle("workspace:load", () => ({ ok: true, workspace }));
  ipcMain.handle("workspace:save", (_, value) => { saved = value; return { ok: true }; });
  ipcMain.handle("workspace:saveDelta", (_, payload) => {
    const tabs = new Map((saved?.tabs ?? workspace.tabs).map(tab => [tab.id, tab]));
    for (const tab of payload.changedTabs) tabs.set(tab.id, tab);
    saved = { ...payload.metadata, tabs: payload.tabIds.map(id => tabs.get(id)) };
    return { ok: true };
  });
  ipcMain.handle("file:getSnapshots", () => []);
  ipcMain.handle("shell:openPath", (_, file) => { opened.push(file); return { ok: true }; });
  ipcMain.handle("app:getInfo", () => ({ version: "test", globalShortcut: shortcut }));
  ipcMain.handle("app:setGlobalShortcut", (_, value) => { if (value === "Ctrl+X") return { ok: false, error: "conflict" }; shortcut = value; return { ok: true, shortcut }; });
  ipcMain.handle("update:getStatus", () => ({ state: "idle", currentVersion: "test", channel: "latest" }));
  for (const name of ["app:rendererReady", "tray:syncTabs", "app:setLanguage"]) ipcMain.handle(name, () => ({ ok: true }));
  const preload = path.join(app.getPath("userData"), "preload.cjs");
  writeFileSync(preload, ts.transpileModule(readFileSync(path.resolve(__dirname, "../electron/preload.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
  win = new BrowserWindow({ show: false, width: 1050, height: 740, webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: false, offscreen: true, backgroundThrottling: false } });
  win.webContents.on("console-message", event => { if (event.level === "error") errors.push(event.message); });
  for (const markdown of [false, true]) {
    await load("前文 ", markdown);
    await win.webContents.insertText("$sec");
    await key("C"); // keyup refreshes the menu after the controlled editor commit
    await waitFor("document.querySelectorAll('.note-reference-picker [role=option]').length === 1");
    await key("Enter");
    await waitFor("document.querySelector('.file-editor').value.includes('super-note://note/second')");
    assert.equal(await evaluate("document.querySelectorAll('.note-reference-cards button').length"), 1);
    const caret = await evaluate("const e=document.querySelector('.file-editor');({start:e.selectionStart,end:e.selectionEnd,length:e.value.length})");
    assert.equal(caret.start, caret.length); assert.equal(caret.end, caret.length);
    await key("Z", ["control"]);
    assert.equal(await evaluate("document.querySelector('.file-editor').value"), "前文 $sec");
    await key("Y", ["control"]);
    if (markdown) {
      await waitFor("document.querySelector('.markdown-live-preview a[href^=\"super-note:\"]')");
      await evaluate("[...document.querySelectorAll('.markdown-editor-modal button')].find(b=>b.textContent.split(' ').join('')==='完成').click()");
    }
    await evaluate("document.querySelector('.note-reference-cards button').click()");
    await waitFor("document.querySelector('.file-view[data-tab-id=second]')");
  }
  await load(String.raw`路径 D:\code\zd\front\h5\web\upload.py 结束`);
  await clickPath(); assert.equal(opened.length, 0);
  await clickPath(["control"], "right"); assert.equal(opened.length, 0);
  await clickPath(["control"]);
  assert.equal(opened[0], String.raw`D:\code\zd\front\h5\web\upload.py`);
  await evaluate("const e=document.querySelector('.file-editor');e.focus();e.setSelectionRange(e.value.length,e.value.length)");
  await win.webContents.insertText(" $z"); await key("Z");
  await waitFor("document.querySelector('.note-reference-empty')");
  await key("Escape"); assert.equal(await evaluate("Boolean(document.querySelector('.note-reference-picker'))"), false);
  await key("Backspace"); await key("Backspace");
  await win.webContents.insertText("$"); await key("4", ["shift"]);
  await waitFor("document.querySelectorAll('.note-reference-picker [role=option]').length===2");
  mkdirSync(path.resolve(__dirname, "../.cache"), { recursive: true });
  await delay(100);
  writeFileSync(path.resolve(__dirname, "../.cache/note-links-picker.png"), (await win.webContents.capturePage()).toPNG());
  await key("Escape");
  await evaluate("[...document.querySelectorAll('.menu-left button')].find(b=>b.textContent.split(' ').join('')==='设置').click()");
  await waitFor("document.querySelector('input[aria-label=\"全局快速打开/关闭\"]')");
  await evaluate("const e=document.querySelector('input[aria-label=\"全局快速打开/关闭\"]');e.focus()");
  await key("N", ["control", "alt"]);
  await evaluate("[...document.querySelectorAll('.global-shortcut-control button')].find(b=>b.textContent.split(' ').join('')==='保存').click()");
  await waitFor("document.querySelector('input[aria-label=\"全局快速打开/关闭\"]').value==='Ctrl+Alt+N'");
  assert.equal(shortcut, "Ctrl+Alt+N");
  await evaluate("document.querySelector('input[aria-label=\"全局快速打开/关闭\"]').focus()");
  await key("X", ["control"]);
  await evaluate("[...document.querySelectorAll('.global-shortcut-control button')].find(b=>b.textContent.split(' ').join('')==='保存').click()");
  await waitFor("document.querySelector('.shortcut-setting-error')");
  assert.equal(shortcut, "Ctrl+Alt+N");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ notePicker: "passed", plainAndMarkdownInsertUndoRedoNavigation: "passed", localPathModifiers: "passed", escapeAndReopen: "passed", shortcutCaptureSaveConflict: "passed", rendererErrors: errors }));
}
app.whenReady().then(verify).then(() => { win?.destroy(); app.exit(0); }).catch(error => { console.error(error.stack); if (errors.length) console.error(errors); win?.destroy(); app.exit(1); });
setTimeout(() => { console.error("Note links verification timed out"); app.exit(1); }, 90000).unref();
