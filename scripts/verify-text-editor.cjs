// Isolated Chromium regression test: never opens or edits the installed app.
// Run: electron scripts/verify-text-editor.cjs [--baseline]
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const { mkdtempSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

app.setPath("userData", mkdtempSync(path.join(os.tmpdir(), "super-note-editor-test-")));
app.disableHardwareAcceleration();
let server;
let win;
const evaluate = expression => win.webContents.executeJavaScript(expression);
const settle = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
const selection = () => evaluate(`(() => { const e = document.querySelector('textarea'); return { value: e.value, start: e.selectionStart, end: e.selectionEnd }; })()`);
const reset = async (content, markdown = false) => {
  await evaluate(`window.editorTest.reset(${JSON.stringify(content)}, ${markdown})`);
  await settle();
};
const focusAt = async (start, end = start) => {
  await evaluate(`(() => { const e = document.querySelector('textarea'); e.focus(); e.setSelectionRange(${start}, ${end}); e.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true })); })()`);
  await settle();
};

async function verify() {
  const { createServer } = await import("vite");
  const baselineFiles = ["src/features/text/FileView.tsx", "src/styles.css"];
  server = await createServer({
    root: path.resolve(__dirname, ".."),
    server: { port: 0, host: "127.0.0.1" },
    plugins: process.argv.includes("--baseline") ? [{
      name: "editor-regression-baseline", enforce: "pre",
      load(id) {
        const file = baselineFiles.find(file => id.replaceAll("\\", "/").endsWith(`/${file}`));
        if (file) return execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8", cwd: path.resolve(__dirname, "..") });
      },
    }] : [],
  });
  await server.listen();
  console.log("Regression server ready");
  win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ["https://fonts.googleapis.com/*", "https://fonts.gstatic.com/*"] }, (_details, callback) => callback({ cancel: true }));
  win.webContents.on("console-message", event => { if (event.level === "error") console.error(event.message); });
  await win.loadURL(`${server.resolvedUrls.local[0]}scripts/fixtures/text-editor.html`);
  console.log("Regression page loaded");
  await evaluate("new Promise(resolve => { const timer = setInterval(() => { if(window.editorTest && document.querySelector('textarea')) { clearInterval(timer); resolve(); } }, 20); })");
  const titleLayout = await evaluate(`(() => {
    const header = document.querySelector('.file-title-bar');
    return { height: header.getBoundingClientRect().height, radius: getComputedStyle(document.querySelector('.file-view')).borderTopLeftRadius,
      title: header.querySelector('h1').textContent, menu: !!header.querySelector('button[aria-label="文档操作"]') };
  })()`);
  assert.deepEqual(titleLayout, { height: 46, radius: "16px", title: "优化 super-note 保存与右键菜单", menu: true });
  console.log("PASS document title bar: current title, menu, 46px height and 16px top corners");

  for (const markdown of [false, true]) {
    await reset("", markdown);
    await focusAt(0);
    let expected = "";
    for (const text of ["a", "b", "c", "你", "好"]) {
      await win.webContents.insertText(text);
      await settle();
      expected += text;
      assert.deepEqual(await selection(), { value: expected, start: expected.length, end: expected.length }, "Typing must advance the caret, including Unicode insertion");
    }
    await focusAt(1, 3);
    await win.webContents.insertText("XY");
    await settle();
    assert.deepEqual(await selection(), { value: "aXY你好", start: 3, end: 3 });
    await win.webContents.insertText("!");
    await settle();
    assert.deepEqual(await selection(), { value: "aXY!你好", start: 4, end: 4 });
    console.log(`PASS ${markdown ? "Markdown" : "plain text"}: typing, Unicode, replacement and middle insertion`);
  }

  const rows = Array.from({ length: 80 }, (_, i) => `row ${String(i).padStart(2, "0")} abcdef 中文文字`).join("\n");
  await reset(rows);
  await focusAt(200, 208);
  await evaluate("document.querySelector('textarea').scrollTop = 320");
  await settle();
  const saved = await evaluate("window.editorTest.saved()");
  assert.equal(saved.selectionStart, 200);
  assert.equal(saved.selectionEnd, 208);
  assert(saved.editorScrollTop > 0);
  await evaluate("window.editorTest.switchTab('second')"); await settle();
  await evaluate("window.editorTest.switchTab('first')"); await settle();
  assert.deepEqual(await selection(), { value: rows, start: 200, end: 208 });
  assert.equal(await evaluate("document.querySelector('textarea').scrollTop"), saved.editorScrollTop);
  console.log("PASS tab return: selection and scroll position preserved");

  // Compare every visible glyph rectangle: adding carets must not change text layout.
  await reset("abcdefghij\nabcdefghij\nabcdefghij\n" + "中文 abcdef ".repeat(18));
  await evaluate(`window.glyphRects = () => {
    const mirror = document.querySelector('.file-highlight');
    const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
    const result = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('.file-multi-caret, .file-highlight-end-marker')) continue;
      for (let i = 0; i < node.length; i++) {
        const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect(); result.push([rect.x, rect.y, rect.width, rect.height]);
      }
    }
    return result;
  }; undefined`);
  const before = await evaluate("window.glyphRects()");
  const point = await evaluate(`(() => {
    const editor = document.querySelector('textarea'); const r = editor.getBoundingClientRect();
    return { x: Math.round(r.x + 46), y: Math.round(r.y + 30), line: parseFloat(getComputedStyle(editor).lineHeight) };
  })()`);
  win.webContents.sendInputEvent({ type: "mouseDown", button: "middle", x: point.x, y: point.y, clickCount: 1 });
  await settle();
  for (let line = 1; line <= 2; line++) {
    win.webContents.sendInputEvent({ type: "mouseMove", button: "middle", x: point.x, y: Math.round(point.y + line * point.line) });
    await settle();
    assert.deepEqual(await evaluate("window.glyphRects()"), before, "Middle drag must not shift or wrap any glyph");
  }
  win.webContents.sendInputEvent({ type: "mouseUp", button: "middle", x: point.x, y: Math.round(point.y + 2 * point.line), clickCount: 1 });
  await settle();
  assert.equal(await evaluate("document.querySelectorAll('.file-multi-caret').length"), 3);
  const markerRects = await evaluate("Array.from(document.querySelectorAll('.file-multi-caret'), marker => { const r = marker.getBoundingClientRect(); return { x: r.x, y: r.y, height: r.height }; })");
  assert(markerRects.every(rect => rect.height > 0));
  assert(markerRects.every(rect => rect.x === markerRects[0].x));
  assert(Math.abs(markerRects[1].y - markerRects[0].y - point.line) < 0.1);
  await evaluate("document.querySelector('textarea').scrollTop = 20");
  await settle();
  const scrolledTop = await evaluate("document.querySelector('.file-multi-caret').getBoundingClientRect().top");
  assert.equal(scrolledTop, markerRects[0].y - 20, "Overlay must follow editor scrolling");
  for (const dark of [false, true]) {
    await evaluate(`document.body.classList.toggle('dark-mode', ${dark})`);
    const styles = await evaluate(`(() => {
      const marker = document.querySelector('.file-multi-caret');
      return { position: getComputedStyle(marker).position, animation: getComputedStyle(marker).animationName,
        caret: getComputedStyle(document.querySelector('textarea')).caretColor };
    })()`);
    assert.equal(styles.position, "absolute");
    assert.equal(styles.animation, "none");
    assert.equal(styles.caret, "rgba(0, 0, 0, 0)");
  }
  const original = (await selection()).value;
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Z" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Z" });
  await settle();
  assert.equal((await selection()).value.length, original.length + 3);
  assert.equal((await selection()).value.split("z").length - 1, 3);
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Backspace" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Backspace" });
  await settle();
  assert.equal((await selection()).value, original, "Deleting at the carets must undo the column insertion");
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
  await settle();
  assert.equal(await evaluate("document.querySelectorAll('.file-multi-caret').length"), 0);
  assert.notEqual(await evaluate("getComputedStyle(document.querySelector('textarea')).caretColor"), "rgba(0, 0, 0, 0)");
  console.log("PASS middle-button column editing: stable text layout, static overlay carets, typing and Escape in both themes");
}

app.whenReady().then(verify).then(async () => {
  win?.destroy(); await server?.close(); app.exit(0);
}).catch(async error => {
  console.error(error); win?.destroy(); await server?.close(); app.exit(1);
});
setTimeout(() => { console.error("Text editor regression test timed out"); app.exit(1); }, 90000).unref();
