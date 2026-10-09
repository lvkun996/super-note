// Build first, then run: electron scripts/verify-text-line-endings.cjs
// Baseline: electron scripts/verify-text-line-endings.cjs --entry release/win-unpacked/resources/app.asar/dist/index.html --expect-misalignment
// Uses isolated app data and synthetic text; never installs or edits user files.
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const { mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const entryIndex = args.indexOf("--entry");
const entry = path.resolve(root, entryIndex >= 0 ? args[entryIndex + 1] : "dist/index.html");
const expectMisalignment = args.includes("--expect-misalignment");
const normalize = content => content.replace(/\r\n?/g, "\n");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.setPath("userData", mkdtempSync(path.join(os.tmpdir(), "super-note-line-endings-")));
app.disableHardwareAcceleration();
let win;
const errors = [];
const evaluate = code => win.webContents.executeJavaScript(`{ ${code} }`, true);
async function waitFor(code) {
  for (let i = 0; i < 100; i++) { if (await evaluate(code)) return; await delay(50); }
  throw new Error(`Timed out: ${code}`);
}
const editorValue = () => evaluate("document.querySelector('.file-editor').value");
async function fixture(content, anchors = [], fontSize = 13, darkMode = false) {
  const tab = { id: "line-test", kind: "file", title: "Existing text", fileName: "existing.txt", filePath: "C:\\synthetic\\existing.txt", content, textAnchors: anchors, fontSize, themeIndex: 0, dirty: false };
  const workspace = { version: 5, savedAt: new Date().toISOString(), activeTabId: tab.id, activePane: "pane-main", paneIds: ["pane-main"], paneActiveTabIds: { "pane-main": tab.id }, tabPaneIds: { [tab.id]: ["pane-main"] }, paneWidths: [100], splitView: false, settings: { tabLayout: "left", sidebarVisible: true, darkMode, followSystemTheme: false }, recentFiles: [], tabs: [tab] };
  await evaluate(`localStorage.setItem('super-note-workspace', ${JSON.stringify(JSON.stringify(workspace))})`);
  await win.loadFile(entry);
  await waitFor("Boolean(document.querySelector('.tabs-sidebar-item'))");
  await evaluate("document.querySelector('.tabs-sidebar-item').click()");
  await waitFor("Boolean(document.querySelector('.file-editor'))");
  await delay(80);
}

// Inspect Chromium's actual textarea glyph layout, not a second approximate mirror.
async function glyphPositions() {
  win.webContents.debugger.attach("1.3");
  try {
    const { root: documentRoot } = await win.webContents.debugger.sendCommand("DOM.getDocument", { depth: -1, pierce: true });
    let textarea;
    function visit(node) {
      if (node.nodeName === "TEXTAREA") textarea = node;
      for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) visit(child);
    }
    visit(documentRoot);
    assert(textarea?.shadowRoots?.length, "Textarea user-agent shadow tree must be available");
    const inner = textarea.shadowRoots[0].children.at(-1);
    const { object } = await win.webContents.debugger.sendCommand("DOM.resolveNode", { nodeId: inner.nodeId });
    const native = await win.webContents.debugger.sendCommand("Runtime.callFunctionOn", {
      objectId: object.objectId, returnByValue: true,
      functionDeclaration: `function() {
        const walker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
        let last; while (walker.nextNode()) last = walker.currentNode;
        const range = document.createRange(); range.setStart(last, last.length - 1); range.setEnd(last, last.length);
        const r = range.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
      }`,
    });
    const mirror = await evaluate(`(() => {
      const walker = document.createTreeWalker(document.querySelector('.file-highlight'), NodeFilter.SHOW_TEXT);
      let last; while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('.file-highlight-end-marker,.file-search-position-marker')) last = walker.currentNode;
      const range = document.createRange(); range.setStart(last, last.length - 1); range.setEnd(last, last.length);
      const r = range.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
    return { native: native.result.value, mirror };
  } finally { win.webContents.debugger.detach(); }
}
async function assertAligned(label) {
  const { native, mirror } = await glyphPositions();
  assert(Math.abs(native.x - mirror.x) < .1, `${label}: horizontal mismatch`);
  assert(Math.abs(native.y - mirror.y) < .1, `${label}: vertical mismatch ${mirror.y - native.y}px`);
  assert.equal(native.height, mirror.height, `${label}: font metrics mismatch`);
}
async function clickAtEnd() {
  const { native } = await glyphPositions();
  const x = Math.round(native.x + native.width + 2), y = Math.round(native.y + native.height / 2);
  win.webContents.sendInputEvent({ type: "mouseDown", button: "left", x, y, clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", button: "left", x, y, clickCount: 1 });
  await delay(60);
  assert.equal(await evaluate("document.querySelector('.file-editor').selectionStart"), (await editorValue()).length);
}

async function verify() {
  win = new BrowserWindow({ show: false, width: 1000, height: 700, webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, nodeIntegration: false } });
  win.webContents.on("console-message", event => { if (event.level === "error") errors.push(event.message); });
  win.webContents.on("render-process-gone", (_, details) => errors.push(details.reason));
  await win.loadFile(entry);
  const broken = "first\r\r\n\r\r\n232";
  if (expectMisalignment) {
    await fixture(broken);
    const { native, mirror } = await glyphPositions();
    assert(native.y - mirror.y > 40, "Original version must reproduce the two-line mismatch");
    console.log(JSON.stringify({ reproduced: true, verticalOffset: native.y - mirror.y }));
    return;
  }

  for (const content of ["first\n\n232", "first\r\n\r\n232", "first\r\r232", broken, "\t你好 😀\r\n\r\n232", "word ".repeat(200) + "\r\r\n\r\r\n232"]) {
    await fixture(content);
    const expected = normalize(content);
    assert.equal(await editorValue(), expected);
    await assertAligned("restored existing file");
    await evaluate("const e=document.querySelector('.file-editor'); e.scrollTop=0; e.focus(); e.setSelectionRange(e.value.length,e.value.length)");
    if (expected.length < 100) await clickAtEnd();
    await win.webContents.insertText("ABC");
    await delay(100);
    assert.equal(await editorValue(), expected + "ABC");
    assert.equal(await evaluate("document.querySelector('.file-editor').selectionStart"), expected.length + 3);
    await assertAligned("normal typing");
    await evaluate(`const e=document.querySelector('.file-editor'); e.setSelectionRange(${expected.indexOf("232")}, ${expected.indexOf("232") + 3})`);
    await win.webContents.insertText("你好");
    await delay(100);
    assert.equal(await editorValue(), expected.replace("232", "你好") + "ABC");
    await assertAligned("selection replacement");
  }

  await fixture(broken);
  await clickAtEnd();
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Return" });
  win.webContents.sendInputEvent({ type: "char", keyCode: "\r" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Return" });
  await delay(100);
  assert.equal(await editorValue(), normalize(broken) + "\n");
  await win.webContents.insertText("next");
  for (const type of ["keyDown", "keyUp"]) win.webContents.sendInputEvent({ type, keyCode: "Backspace" });
  await delay(100);
  assert.equal(await editorValue(), normalize(broken) + "\nnex");
  await assertAligned("Enter and Backspace");

  // Exercise middle-button column selection and its paste handler.
  await fixture("aa\nbb");
  const column = await evaluate(`(() => {
    const node=document.querySelector('.file-highlight').firstChild;
    const range=document.createRange(); range.setStart(node,1); range.setEnd(node,1);
    const r=range.getBoundingClientRect();
    return {x:Math.round(r.x),y:Math.round(r.y+r.height/2),lineHeight:parseFloat(getComputedStyle(document.querySelector('.file-editor')).lineHeight)};
  })()`);
  win.webContents.sendInputEvent({ type: "mouseDown", button: "middle", x: column.x, y: column.y, clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseMove", x: column.x, y: Math.round(column.y + column.lineHeight) });
  win.webContents.sendInputEvent({ type: "mouseUp", button: "middle", x: column.x, y: Math.round(column.y + column.lineHeight), clickCount: 1 });
  await waitFor("document.querySelectorAll('.file-multi-caret').length === 2");
  await evaluate("const data=new DataTransfer();data.setData('text/plain','X\\r\\r\\nY');document.querySelector('.file-editor').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:data}))");
  await delay(100);
  assert.equal(await editorValue(), "aX\n\nYa\nbX\n\nYb");
  assert.equal(await evaluate("document.querySelector('.file-editor').selectionStart"), 12);
  await assertAligned("multi-caret paste");

  // Persisted anchors, global search and ordinary editing must share LF offsets.
  await fixture(broken, [{ id: "a", start: broken.indexOf("232"), end: broken.length, label: "232" }]);
  await waitFor("document.querySelectorAll('.file-anchor-marker').length === 1");
  await evaluate("document.querySelector('.file-title-anchor').click()");
  await waitFor("Boolean(document.querySelector('.text-anchor-menu-label'))");
  await evaluate("document.querySelector('.text-anchor-menu-label').click()");
  assert.equal(await evaluate("document.querySelector('.file-editor').selectionStart"), 9);
  await evaluate("document.querySelector('.window-control[aria-label=搜索]').click()");
  await waitFor("Boolean(document.querySelector('#global-search-input'))");
  await evaluate("const i=document.querySelector('#global-search-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'232');i.dispatchEvent(new Event('input',{bubbles:true}))");
  await waitFor("document.querySelectorAll('.search-result').length === 1");
  await evaluate("document.querySelector('.search-result').click()");
  await waitFor("!document.querySelector('#global-search-input')");
  assert.deepEqual(await evaluate("const e=document.querySelector('.file-editor');({start:e.selectionStart,end:e.selectionEnd,text:e.value.slice(e.selectionStart,e.selectionEnd)})"), { start: 9, end: 12, text: "232" });

  // Exercise the actual file-opening handler using an isolated dropped File.
  await fixture("initial");
  await evaluate(`window.sourceTestFile=new File([${JSON.stringify(broken)}],'opened.txt',{type:'text/plain'});const data=new DataTransfer();data.items.add(window.sourceTestFile);document.querySelector('.app-shell').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:data}))`);
  await waitFor("document.querySelector('.file-title')?.textContent === 'opened.txt'");
  assert.equal(await editorValue(), normalize(broken));
  await assertAligned("opened file before first keystroke");
  await clickAtEnd();
  await win.webContents.insertText("!");
  await delay(100);
  assert.equal(await editorValue(), normalize(broken) + "!");
  assert.equal(await evaluate("window.sourceTestFile.text()"), broken, "Opening and editing must not mutate the source File");

  // Paste through the context menu, avoiding the real system clipboard.
  await evaluate("window.superNote={readClipboardText:async()=> 'X\\r\\r\\nY',saveWorkspace:async()=>({ok:true})};const e=document.querySelector('.file-editor');e.setSelectionRange(e.value.length,e.value.length);e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:200}))");
  await waitFor("Boolean([...document.querySelectorAll('.ant-dropdown-menu-item')].find(e=>e.textContent==='粘贴'))");
  await evaluate("[...document.querySelectorAll('.ant-dropdown-menu-item')].find(e=>e.textContent==='粘贴').click()");
  await delay(100);
  assert.equal(await editorValue(), normalize(broken) + "!X\n\nY");
  assert.equal(await evaluate("document.querySelector('.file-editor').selectionStart"), (await editorValue()).length);
  await assertAligned("context-menu paste");

  for (const dark of [false, true]) {
    await fixture("row\r\n".repeat(100) + "232", [], 24, dark);
    await evaluate("const e=document.querySelector('.file-editor');e.focus();e.setSelectionRange(e.value.length,e.value.length);e.scrollTop=500");
    await delay(100);
    await win.webContents.insertText("abc");
    await delay(100);
    await assertAligned("scrolled/zoomed typing");
    win.setSize(900, 700);
    await delay(100);
    await assertAligned("window resize");
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ restoredFiles: "passed", normalTyping: "passed", enterBackspace: "passed", selectionReplacement: "passed", multiCaretPaste: "passed", anchorsAndSearch: "passed", fileOpening: "passed", sourceUnchanged: "passed", contextMenuPaste: "passed", scrollZoomThemes: "passed", rendererErrors: errors }));
}

app.whenReady().then(verify).then(() => { win?.destroy(); app.exit(0); }).catch(error => {
  console.error(error.stack); if (errors.length) console.error(JSON.stringify(errors));
  win?.destroy(); app.exit(1);
});
setTimeout(() => { console.error("Line-ending verification timed out"); app.exit(1); }, 60000).unref();
