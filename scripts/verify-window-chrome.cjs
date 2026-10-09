// Build first: npm run build && electron scripts/verify-window-chrome.cjs
// Isolated app data, synthetic documents and mocked IPC: no user files or clipboard.
const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getWindowMaterial } = require("../dist-electron/windowMaterial.js");
const output = mkdtempSync(path.join(os.tmpdir(), "super-note-window-chrome-"));
app.setPath("userData", output);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let win, other, workspace;
const errors = [];
const evaluate = code => win.webContents.executeJavaScript(`{ ${code} }`, true);
async function waitFor(code) {
  for (let i = 0; i < 100; i++) { if (await evaluate(code)) return; await delay(50); }
  throw new Error(`Timed out: ${code}`);
}
function makeWorkspace(darkMode, tabLayout = "left") {
  const tab = { id: "fixture", kind: "file", title: "Synthetic notes", fileName: "synthetic.txt", content: "Focus keeps text clear.\nOnly navigation backgrounds become translucent.", fontSize: 13, themeIndex: 0, dirty: false };
  return { version: 5, savedAt: new Date().toISOString(), tabs: [tab], activeTabId: tab.id, activePane: "pane-main", paneIds: ["pane-main"], paneActiveTabIds: { "pane-main": tab.id }, tabPaneIds: { [tab.id]: ["pane-main"] }, paneWidths: [100], splitView: false, settings: { darkMode, followSystemTheme: false, tabLayout, sidebarVisible: true }, recentFiles: [] };
}
async function fixture(dark, layout = "left") {
  workspace = makeWorkspace(dark, layout);
  await win.loadFile(path.resolve(__dirname, "../dist/index.html"));
  await waitFor("Boolean(document.querySelector('.tabs-sidebar-item,.tab-label'))");
  await evaluate("document.querySelector('.tabs-sidebar-item,.tab-label').click()");
  await waitFor("Boolean(document.querySelector('.file-editor'))");
  await delay(180);
}
async function focus(enabled) {
  (enabled ? win : other).show();
  (enabled ? win : other).focus();
  await waitFor(`document.querySelector('.app-shell').classList.contains('window-focused') === ${enabled}`);
  await delay(200);
}
async function inspect(expectedOpacity) {
  const result = await evaluate(`(() => {
    const shell=document.querySelector('.app-shell');
    const nav=[...document.querySelectorAll('.app-titlebar,.tabs-sidebar,.tabs-bar')];
    return { alpha:Number(getComputedStyle(shell).getPropertyValue('--navigation-background-opacity')),
      textOpacity:nav.map(el=>getComputedStyle(el).opacity),
      contentBackground:getComputedStyle(document.querySelector('.work-pane')).backgroundColor,
      rootBackground:getComputedStyle(document.documentElement).backgroundColor,
      material:window.superNote.windowBackdropEnabled,
      overflow:document.documentElement.scrollWidth > innerWidth,
      titleHeight:document.querySelector('.app-titlebar').getBoundingClientRect().height,
      sidebarHeight:document.querySelector('.tabs-sidebar-header')?.getBoundingClientRect().height,
      documentHeight:document.querySelector('.file-title-bar')?.getBoundingClientRect().height,
    };
  })()`);
  assert.equal(result.alpha, expectedOpacity);
  assert(result.textOpacity.every(value => value === "1"), "Text and buttons must not fade with the surface");
  assert(!result.contentBackground.includes("rgba"), "The document must remain opaque");
  assert.equal(result.material, true);
  assert.equal(result.rootBackground, "rgba(0, 0, 0, 0)");
  assert.equal(result.overflow, false);
  assert.equal(result.titleHeight, 32);
  if (result.sidebarHeight) assert.equal(result.sidebarHeight, result.documentHeight);
  return result;
}
async function screenshot(label) {
  const shot = await win.webContents.capturePage();
  writeFileSync(path.join(output, `${label}.png`), shot.toPNG());
  const bitmap = shot.toBitmap();
  const alpha = await evaluate("Number(getComputedStyle(document.querySelector('.app-shell')).getPropertyValue('--navigation-background-opacity'))");
  const points = [[500, 12]];
  if (await evaluate("Boolean(document.querySelector('.tabs-sidebar'))")) points.push([20, 250]);
  for (const [x, y] of points) {
    const offset = (y * shot.getSize().width + x) * 4;
    assert(Math.abs(bitmap[offset + 3] - Math.round(alpha * 255)) <= 1, `${label}: rendered chrome must have the expected alpha`);
  }
}
async function verify() {
  const material = getWindowMaterial(process.platform, os.release(), typeof BrowserWindow.prototype.setBackgroundMaterial === "function");
  assert.equal(material, "acrylic", "This native regression requires Windows 11 22H2+; unit tests cover older platforms");
  ipcMain.handle("workspace:load", () => ({ ok: true, workspace }));
  ipcMain.handle("app:getInfo", () => ({ version: "test", author: "test", desc: "Synthetic fixture" }));
  ipcMain.handle("update:getStatus", () => ({ state: "idle", channel: "latest", currentVersion: "test" }));
  for (const name of ["workspace:save", "app:rendererReady", "app:setLanguage", "tray:syncTabs"]) ipcMain.handle(name, () => ({ ok: true }));
  win = new BrowserWindow({ show: false, width: 1000, height: 700, frame: false, backgroundColor: "#00000000", backgroundMaterial: material,
    webPreferences: { preload: path.resolve(__dirname, "../dist-electron/preload.js"), additionalArguments: ["--super-note-window-backdrop"], contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  // A small separate fixture provides real OS blur/focus events, not synthetic events.
  other = new BrowserWindow({ show: false, width: 220, height: 120, skipTaskbar: true });
  await other.loadURL("data:text/html,<body style='font:13px Segoe UI'>Window focus test</body>");
  win.webContents.on("console-message", event => { if (event.level === "error") errors.push(event.message); });
  for (const dark of [false, true]) {
    await fixture(dark);
    await focus(true);
    await inspect(dark ? .8 : .72);
    await evaluate("document.querySelector('.menu-left button').click()");
    await waitFor("Boolean(document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)'))");
    await inspect(dark ? .8 : .72);
    await evaluate("document.querySelector('.file-editor').click()");
    await screenshot(`${dark ? "dark" : "light"}-focused`);
    await focus(false);
    await inspect(1);
    await screenshot(`${dark ? "dark" : "light"}-unfocused`);
    await focus(true);
    win.setSize(960, 680);
    await delay(200);
    await inspect(dark ? .8 : .72);
    win.maximize();
    await delay(250);
    assert(win.isMaximized(), "Native material must preserve maximization");
    await inspect(dark ? .8 : .72);
    win.unmaximize();
    await delay(200);
    await win.webContents.debugger.attach("1.3");
    await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }, { name: "prefers-reduced-motion", value: "reduce" }] });
    await delay(200);
    await inspect(1);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.app-shell')).transitionDuration"), "0s");
    await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-contrast", value: "more" }] });
    await delay(200);
    await inspect(1);
    await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [] });
    win.webContents.debugger.detach();
    await delay(200);
    await inspect(dark ? .8 : .72);
  }
  await fixture(false, "top");
  await focus(true);
  await inspect(.72);
  await screenshot("top-tabs-focused");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ nativeFocusBlur: "passed", backgroundOnly: "passed", lightDark: "passed", resizeMaximize: "passed", reducedTransparencyMotion: "passed", topTabs: "passed", screenshots: output, rendererErrors: errors }));
}
app.whenReady().then(verify).then(() => { win?.destroy(); other?.destroy(); app.exit(0); }).catch(error => {
  console.error(error.stack); if (errors.length) console.error(JSON.stringify(errors));
  win?.destroy(); other?.destroy(); app.exit(1);
});
setTimeout(() => { console.error("Window chrome verification timed out"); app.exit(1); }, 60000).unref();
