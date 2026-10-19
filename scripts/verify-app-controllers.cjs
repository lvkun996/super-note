// Build first, then run: electron scripts/verify-app-controllers.cjs
// Actual renderer/preload with isolated app data and mocked file IPC.
const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
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
let win, saved, filePayload, failSave = false, flushed = false, clipboardWritten;
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
async function editorFixture(content, markdown = false) {
  console.log("Fixture", markdown ? "Markdown" : "text", JSON.stringify(content.slice(0,28)));
  source.tabs = [tab("first", content), tab("second", "another document")];
  source.tabs[0].fileName = markdown ? "first.md" : "first.txt";
  await win.loadFile(path.resolve(__dirname, "../dist/index.html"));
  await waitFor("document.querySelectorAll('.tabs-sidebar-item').length === 2");
  await evaluate("document.querySelector('.tabs-sidebar-item').click()");
  if (markdown) {
    await waitFor("Boolean(document.querySelector('.file-title-edit'))");
    await evaluate("document.querySelector('.file-title-edit').click()");
  }
  await waitFor("Boolean(document.querySelector('.file-editor'))");
  await delay(100);
}
async function selectText(start, end = start, direction = "none") {
  await evaluate(`const e=document.querySelector('.file-editor');e.focus();e.setSelectionRange(${start},${end},${JSON.stringify(direction)});e.dispatchEvent(new Event('select',{bubbles:true}));e.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}))`);
  await delay(30);
}
const caretState = () => evaluate("const e=document.querySelector('.file-editor');({content:e.value,start:e.selectionStart,end:e.selectionEnd,direction:e.selectionDirection,scroll:e.scrollTop})");
async function nativeKey(keyCode, modifiers = []) {
  for (const type of ["keyDown", "keyUp"]) win.webContents.sendInputEvent({ type, keyCode, modifiers });
  await delay(50);
  await evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
}
async function typeText(text) { await win.webContents.insertText(text); await delay(40); }
async function contextAction(label) {
  await evaluate("document.querySelector('.file-editor').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:200}))");
  await waitFor(`Boolean([...document.querySelectorAll('.ant-dropdown-menu-item')].find(e=>e.textContent===${JSON.stringify(label)}))`);
  await evaluate(`[...document.querySelectorAll('.ant-dropdown-menu-item')].find(e=>e.textContent===${JSON.stringify(label)}).click()`);
  await delay(100);
}
async function verifyEditingTransactions() {
  for (const markdown of [false, true]) {
    await editorFixture("A:\nB:\nC:", markdown);
    await selectText(2);
    for (const c of "abc") await typeText(c);
    await selectText(8);
    for (const c of "defg") await typeText(c);
    await nativeKey("Z", ["control"]);
    assert.deepEqual(await caretState(), {content:"A:abc\nB:def\nC:",start:11,end:11,direction:"forward",scroll:0}, "Undo must remain on the middle line");
    await nativeKey("Y", ["control"]);
    assert.equal((await caretState()).start, 12);
    await nativeKey("Z", ["control"]);
    await typeText("Q");
    assert.equal(await value(), "A:abc\nB:defQ\nC:", "Typing after undo must use the restored caret");
    await nativeKey("Y", ["control"]);
    assert.equal(await value(), "A:abc\nB:defQ\nC:", "A new edit invalidates both custom and native redo");

    await editorFixture("left\nabcdef\nright", markdown);
    await selectText(6,9,"backward");
    await typeText("X");
    await nativeKey("Z", ["control"]);
    assert.deepEqual({...(await caretState()),scroll:0}, {content:"left\nabcdef\nright",start:6,end:9,direction:"backward",scroll:0});
    await nativeKey("Z", ["control","shift"]);
    assert.equal(await value(), "left\naXef\nright");
    assert.equal((await caretState()).start, 7);

    await editorFixture("A\nB\nC", markdown);
    await selectText(2);
    await nativeKey("Backspace");
    assert.equal(await value(), "AB\nC");
    await nativeKey("Z", ["control"]);
    assert.equal(await value(), "A\nB\nC");
    assert.equal((await caretState()).start,2);
    await nativeKey("Delete");
    await nativeKey("Z", ["control"]);
    assert.equal((await caretState()).start,2);

    await editorFixture("6. Parent\n", markdown);
    await selectText(10);
    await nativeKey("Tab");
    assert.equal(await value(), "6. Parent\n6.1 ");
    assert.equal((await caretState()).start,14);
    await nativeKey("Z", ["control"]);
    assert.equal((await caretState()).start,10);
    await nativeKey("Y", ["control"]);
    assert.equal((await caretState()).start,14);

    await editorFixture("one\n\n \t\n中文 text\n\nlast", markdown);
    const original = await value();
    await selectText(0,original.length,"backward");
    const painting = await evaluate("({native:getComputedStyle(document.querySelector('.file-editor'),'::selection').backgroundColor,rects:[...document.querySelectorAll('.file-text-selection')].map(e=>({top:parseFloat(e.style.top),width:parseFloat(e.style.width)}))})");
    assert.equal(painting.native,"rgba(0, 0, 0, 0)");
    assert(painting.rects.length >= 3);
    const paintedRows = new Set(painting.rects.map(r=>Math.round(r.top)));
    assert.equal(paintedRows.size,3,"Empty and whitespace-only rows must not be highlighted");
    await contextAction("复制");
    assert.equal(clipboardWritten,original,"Clipboard must retain all selected newlines and spaces");
    await contextAction("剪切");
    assert.equal(await value(),"");
    await nativeKey("Z",["control"]);
    assert.equal(await value(),original);
    assert.equal((await caretState()).direction,"backward");
    await contextAction("粘贴");
    assert.equal(await value(),"paste\n中文");
    await nativeKey("Z",["control"]);
    assert.equal(await value(),original);
    await nativeKey("Escape");
    if(!markdown) writeFileSync(path.resolve(__dirname,"../.cache/editor-selection-fixed.png"),(await win.webContents.capturePage()).toPNG());
  }
  await editorFixture("A:\nB:\nC:");
  await selectText(5);
  await evaluate("const e=document.querySelector('.file-editor');e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));const put=v=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,v);e.setSelectionRange(v.indexOf('\\nC:'),v.indexOf('\\nC:'));e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText'}))};put('A:\\nB:n\\nC:')");
  await delay(50);
  await evaluate("const e=document.querySelector('.file-editor');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'A:\\nB:你\\nC:');e.setSelectionRange(6,6);e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText'}));e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'你'}))");
  await delay(50);
  await nativeKey("Z",["control"]);
  assert.equal(await value(),"A:\nB:\nC:","A composition must undo as one transaction");
  assert.equal((await caretState()).start,5);

  await editorFixture("row\n".repeat(120)+"end");
  await selectText(4*60+2);
  await evaluate("document.querySelector('.file-editor').scrollTop=1150");
  await delay(80);
  const scrollBefore=(await caretState()).scroll;
  await typeText("x");
  await nativeKey("Z",["control"]);
  assert.equal((await caretState()).scroll,scrollBefore,"Undo restores the editor's scroll snapshot");
  await key("f");
  await waitFor("Boolean(document.querySelector('#global-search-input'))");
  await evaluate("document.querySelector('#global-search-input').focus()");
  const contentBefore=await value();
  await nativeKey("Z",["control"]);
  assert.equal(await value(),contentBefore,"Undo inside search must not undo the document");
  await key("Escape",[]);

  await editorFixture("abcd\nabcd\nabcd");
  const point=await evaluate("const e=document.querySelector('.file-editor'),r=e.getBoundingClientRect(),s=getComputedStyle(e);({x:Math.round(r.x+parseFloat(s.paddingLeft)+10),y:Math.round(r.y+parseFloat(s.paddingTop)+8),line:parseFloat(s.lineHeight)})");
  win.webContents.sendInputEvent({type:"mouseDown",button:"middle",x:point.x,y:point.y,clickCount:1});
  await delay(40);
  win.webContents.sendInputEvent({type:"mouseMove",button:"middle",x:point.x,y:Math.round(point.y+point.line*2)});
  win.webContents.sendInputEvent({type:"mouseUp",button:"middle",x:point.x,y:Math.round(point.y+point.line*2),clickCount:1});
  await waitFor("document.querySelectorAll('.file-multi-caret').length===3");
  await nativeKey("X");
  const multiValue=await value();
  await nativeKey("Z",["control"]);
  assert.equal(await value(),"abcd\nabcd\nabcd");
  assert.equal(await evaluate("document.querySelectorAll('.file-multi-caret').length"),3);
  await nativeKey("Y",["control"]);
  assert.equal(await value(),multiValue);
  await nativeKey("Escape");
  assert.equal(await evaluate("document.querySelectorAll('.file-multi-caret').length"),0);
  await editorFixture("original changed");
  console.log("PASS middle-line undo/redo, backward selections, deletion, list editing, copy/cut/paste, simulated IME, scrolling, search isolation, multi-caret history and selection painting (text + Markdown)");
}

async function verify() {
  ipcMain.handle("clipboard:readText", () => "paste\n中文");
  ipcMain.handle("clipboard:writeText", (_, text) => {clipboardWritten=text; return {ok:true}});
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

  await verifyEditingTransactions();

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
setTimeout(() => { console.error("Controller verification timed out"); app.exit(1); }, 120000).unref();

