// Synthetic workspace and isolated profile; never launches the installed app.
const { app, BrowserWindow, ipcMain } = require("electron");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
app.setPath("userData", mkdtempSync(path.join(os.tmpdir(), "super-note-perf-")));
app.disableHardwareAcceleration();
let win, workspace;
const counts = { tray: 0, saves: 0, bytes: 0, snapshots: 0 };
const evaluate = code => win.webContents.executeJavaScript(`{ ${code} }`, true);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(code) {
  for (let n = 0; n < 200; n++) { if (await evaluate(code)) return; await delay(25); }
  throw new Error(`Timed out: ${code}`);
}
const frame = () => evaluate("new Promise(resolve=>requestAnimationFrame(resolve))");
const distribution = values => {
  const sorted = [...values].sort((a,b)=>a-b);
  return { p50: +sorted[Math.floor(sorted.length*.5)].toFixed(2), p95: +sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))].toFixed(2) };
};
async function open(markdown) {
  const text = markdown ? "# 标题\n\n" + "段落 **粗体** 与 [链接](https://example.com)\n\n".repeat(4000)
    : Array.from({length:8000},(_,i)=>`line ${i} 中文 abcdefghijklmnopqrstuvwxyz`).join("\n");
  const tabs = Array.from({length:100},(_,i)=>({id:`t${i}`,kind:"file",title:`document-${i}`,fileName:i===0&&markdown?"bench.md":"bench.txt",
    filePath:`C:\\synthetic\\${i===0&&markdown?"bench.md":`bench-${i}.txt`}`,content:i===0?text:"unchanged document\n".repeat(500),dirty:false,fontSize:13,themeIndex:0}));
  workspace={version:5,savedAt:new Date().toISOString(),tabs,activeTabId:"t0",paneIds:["pane-main"],activePane:"pane-main",paneActiveTabIds:{"pane-main":"t0"},tabPaneIds:Object.fromEntries(tabs.map(t=>[t.id,["pane-main"]])),paneWidths:[100],settings:{tabLayout:"left",sidebarVisible:true,language:"zh-CN"},recentFiles:[]};
  const previous=win;
  win=new BrowserWindow({show:false,width:1200,height:800,webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.resolve(__dirname,"../dist-electron/preload.js"),sandbox:false,contextIsolation:true}});
  previous?.destroy();
  await win.loadFile(path.resolve(__dirname,"../dist/index.html"));
  await waitFor("document.querySelectorAll('.tabs-sidebar-item').length===100");
  await evaluate("document.querySelector('.tabs-sidebar-item').click()");
  if(markdown){ await waitFor("Boolean(document.querySelector('.file-title-edit'))");await evaluate("document.querySelector('.file-title-edit').click()"); }
  await waitFor("Boolean(document.querySelector('.file-editor'))");
  await evaluate("const e=document.querySelector('.file-editor');e.focus();e.setSelectionRange(e.value.length,e.value.length)");
  await win.webContents.insertText("warmup"); await delay(800); await frame();
  if(markdown){await waitFor("document.querySelector('.markdown-live-preview')?.textContent.includes('warmup')");await evaluate("window.benchmarkHeading=document.querySelector('.markdown-live-preview h1')");}
  win.webContents.debugger.attach("1.3"); await win.webContents.debugger.sendCommand("Performance.enable");
  await evaluate("window.longTasks=[];window.longTaskObserver=new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>e.duration)));window.longTaskObserver.observe({type:'longtask',buffered:false})");
  for(const key of Object.keys(counts))counts[key]=0;
  return text.length;
}
async function metrics() {
  const result=await win.webContents.debugger.sendCommand("Performance.getMetrics");
  return Object.fromEntries(result.metrics.map(m=>[m.name,m.value]));
}
async function scenario(markdown) {
  const characters=await open(markdown), start=await metrics(), samples=[];
  for(let i=0;i<24;i++){
    const before=performance.now();await win.webContents.insertText("x");await frame();samples.push(performance.now()-before);
  }
  await delay(250);
  if(markdown)await waitFor(`document.querySelector('.markdown-live-preview')?.textContent.trim().endsWith('warmup${"x".repeat(24)}')`);
  const end=await metrics(), tasks=await evaluate("window.longTasks");
  const targets=await win.webContents.debugger.sendCommand("Target.getTargets");
  const workerCount=targets.targetInfos.filter(target=>target.type==="worker").length;
  if(markdown&&process.argv.includes("--require-worker")&&workerCount===0)throw new Error("Markdown worker did not start in the built file:// app");
  if(markdown&&process.argv.includes("--require-worker")&&!await evaluate("window.benchmarkHeading===document.querySelector('.markdown-live-preview h1')"))throw new Error("Unchanged Markdown heading was replaced");
  const typing={...distribution(samples),scriptMs:+((end.ScriptDuration-start.ScriptDuration)*1000).toFixed(2),layoutMs:+((end.LayoutDuration-start.LayoutDuration)*1000).toFixed(2),layouts:end.LayoutCount-start.LayoutCount,longTasks:tasks.length,maxLongTaskMs:+Math.max(0,...tasks).toFixed(2),heapMiB:+(end.JSHeapUsedSize/1024/1024).toFixed(2),trayUpdates:counts.tray};
  const switches=[];
  if(!markdown) for(let i=0;i<8;i++){
    const before=performance.now();await evaluate(`document.querySelectorAll('.tabs-sidebar-item')[${i%2?0:1}].click()`);await frame();switches.push(performance.now()-before);
  }
  await delay(800);
  return {characters,tabs:100,typing,tabSwitch: switches.length?distribution(switches):undefined,saveIpc:{requests:counts.saves,bytes:counts.bytes},workerCount};
}
async function main(){
  ipcMain.handle("workspace:load",()=>({ok:true,workspace}));
  ipcMain.handle("workspace:save",(_,value)=>{counts.saves++;counts.bytes+=JSON.stringify(value).length;return {ok:true}});
  ipcMain.handle("workspace:saveDelta",(_,value)=>{counts.saves++;counts.bytes+=JSON.stringify(value).length;return {ok:true}});
  ipcMain.handle("tray:syncTabs",()=>{counts.tray++;return {ok:true}});
  ipcMain.handle("file:getSnapshots",()=>{counts.snapshots++;return []});
  ipcMain.handle("app:getInfo",()=>({version:"benchmark"}));
  ipcMain.handle("update:getStatus",()=>({state:"idle",currentVersion:"benchmark"}));
  for(const channel of ["app:setLanguage","app:rendererReady","mindmap-style:sync"])ipcMain.handle(channel,()=>({ok:true}));
  const result=process.argv.includes("--markdown-only")?{markdown:await scenario(true)}:{plain:await scenario(false),markdown:await scenario(true)};
  const label=process.argv.find(arg=>arg.startsWith("--label="))?.slice(8)||"current";
  if(!/^[a-z0-9-]+$/i.test(label))throw new Error("Invalid label");
  mkdirSync(path.resolve(__dirname,"../.cache"),{recursive:true});
  writeFileSync(path.resolve(__dirname,`../.cache/app-performance-${label}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
app.whenReady().then(main).then(()=>{win?.destroy();app.exit(0)}).catch(error=>{console.error(error);win?.destroy();app.exit(1)});
setTimeout(()=>{console.error("Benchmark timed out");app.exit(1)},120000).unref();
