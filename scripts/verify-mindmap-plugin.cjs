// Isolated Electron fixture. No installed profile, real documents, or clipboard.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const output = mkdtempSync(path.join(os.tmpdir(), 'super-note-plugin-'));
app.setPath('userData', output);
let win, saved, workspace;
const errors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = code => win.webContents.executeJavaScript(`{ ${code} }`, true);
async function waitFor(code) {
  for (let n = 0; n < 120; n++) { if (await evaluate(code)) return; await delay(50); }
  throw new Error(`Timed out: ${code}`);
}
async function click(text, selector = 'button') {
  await evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw new Error('Missing control'); el.click(); })()`);
}
async function plugin(text) {
  await click('插件');
  await waitFor(`Boolean([...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')].find(el => el.textContent.includes(${JSON.stringify(text)})))`);
  await evaluate(`[...document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item')].find(el => el.textContent.includes(${JSON.stringify(text)})).click()`);
  await delay(100);
  win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', x: 900, y: 620, clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', x: 900, y: 620, clickCount: 1 });
  await waitFor("!document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)')");
}
async function load(value) {
  workspace = value;
  saved = null;
  await win.loadFile(path.resolve(__dirname, '../dist/index.html'));
  await waitFor("Boolean(document.querySelector('.tabs-sidebar-actions'))");
}
async function verify() {
  ipcMain.handle('workspace:load', () => ({ ok: true, workspace }));
  ipcMain.handle('workspace:save', (_, value) => { saved = value; return { ok: true }; });
  ipcMain.handle('app:getInfo', () => ({ version: 'fixture' }));
  ipcMain.handle('update:getStatus', () => ({ state: 'idle', currentVersion: 'fixture' }));
  for (const name of ['app:rendererReady', 'app:setLanguage', 'tray:syncTabs', 'mindmap-style:sync']) ipcMain.handle(name, () => ({ ok: true }));
  win = new BrowserWindow({ show: true, width: 1000, height: 700, webPreferences: { preload: path.resolve(__dirname, '../dist-electron/preload.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false } });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const initial = { version: 5, savedAt: new Date().toISOString(), tabs: [], paneIds: ['pane-main'], paneWidths: [100], activePane: 'pane-main', splitView: false, settings: { tabLayout: 'left', plugins: { canvas: false, mindMap: false } } };
  await load(initial);
  assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"新建思维导图\"]'))"), false);
  await plugin('思维导图插件');
  await waitFor("Boolean(document.querySelector('[aria-label=\"新建思维导图\"]'))");
  assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"新建画板\"]'))"), false);
  await evaluate("document.querySelector('[aria-label=\"新建思维导图\"]').click()");
  await waitFor("Boolean(document.querySelector('.mind-map-node'))");
  await evaluate("document.querySelector('.mind-map-node').click()");
  await waitFor("[...document.querySelectorAll('.canvas-command-bar button')].some(el => el.textContent.trim() === '子主题' && !el.disabled)");
  await click('子主题');
  await waitFor("document.querySelectorAll('.mind-map-node').length === 4");
  // Commit the newly-created input before disabling the plugin.
  await evaluate("document.querySelector('.mind-map-node-input')?.blur()");
  await delay(750);
  assert.equal(saved.settings.plugins.mindMap, true);
  assert.equal(saved.settings.plugins.canvas, false);
  const mapId = saved.activeTabId;
  const nodes = saved.tabs.find(tab => tab.id === mapId).mindMap.nodes.length;
  assert.equal(nodes, 4);
  writeFileSync(path.join(output, 'standalone-mindmap.png'), (await win.webContents.capturePage()).toPNG());
  await plugin('思维导图插件');
  await waitFor("Boolean(document.querySelector('.plugin-disabled'))");
  assert.equal(await evaluate("Boolean(document.querySelector('.mind-map-layer'))"), false);
  await delay(750);
  assert.equal(saved.tabs.find(tab => tab.id === mapId).mindMap.nodes.length, nodes);
  const reload = JSON.parse(JSON.stringify(saved));
  await load(reload);
  await evaluate("document.querySelector('.tabs-sidebar-item').click()");
  await waitFor("Boolean(document.querySelector('.plugin-disabled'))");
  await click('启用思维导图插件');
  await waitFor("document.querySelectorAll('.mind-map-node').length === 4");
  await plugin('画板插件');
  await waitFor("Boolean(document.querySelector('[aria-label=\"新建画板\"]'))");
  await evaluate("document.querySelector('[aria-label=\"新建画板\"]').click()");
  await waitFor("Boolean(document.querySelector('.canvas-frame')) && !document.querySelector('.mind-map-layer')");
  assert.equal(await evaluate("[...document.querySelectorAll('.canvas-command-bar button')].some(el=>el.textContent.includes('新建思维导图'))"), false);
  // Legacy mixed canvas/map files stay intact, but also require opt-in.
  await delay(750);
  const legacy = JSON.parse(JSON.stringify(reload));
  legacy.settings.plugins = { canvas: true };
  delete legacy.tabs[0].canvasMode;
  legacy.tabs[0].items = [{ id: 'legacy-note', type: 'text', text: 'Preserved legacy note', x: 20, y: 20, width: 160, height: 30 }];
  await load(legacy);
  await evaluate("document.querySelector('.tabs-sidebar-item').click()");
  await waitFor("Boolean(document.querySelector('.plugin-disabled'))");
  await click('启用思维导图插件');
  await waitFor("Boolean(document.querySelector('.mind-map-layer'))");
  await delay(750);
  assert.equal(saved.tabs[0].items[0].text, 'Preserved legacy note');
  assert.equal(saved.tabs[0].canvasMode, 'mindmap');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ independentOptIn: 'passed', independentCreation: 'passed', editing: 'passed', disablePreservesContents: 'passed', persistence: 'passed', boardSeparation: 'passed', legacyMigration: 'passed', screenshots: output }));
}
app.whenReady().then(verify).then(() => { win.destroy(); app.exit(0); }).catch(async error => { console.error(error.stack); console.error(errors); console.error(await evaluate('document.body.innerText').catch(() => 'unavailable')); win?.destroy(); app.exit(1); });
setTimeout(() => { console.error('Plugin verification timed out'); app.exit(1); }, 60000).unref();
