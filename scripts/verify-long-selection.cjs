const assert = require("node:assert/strict");
module.exports = async function verifyLongSelection({reset, evaluate, settle}) {
  const content = Array.from({length:8000}, (_, i) => `row ${i} 中文 abcdef`).join("\n");
  await reset(content);
  await evaluate(`(() => {
    const e=document.querySelector('textarea'); e.focus();e.setSelectionRange(0,e.value.length);
    e.scrollTop=e.scrollHeight/2;e.dispatchEvent(new Event('scroll',{bubbles:true}));
  })()`);
  await settle();
  await evaluate(`(() => {
    window.rangeMeasurements=0; const original=document.createRange.bind(document);
    document.createRange=()=>{window.rangeMeasurements++;return original()};
    document.dispatchEvent(new Event('selectionchange'));
  })()`);
  await settle();
  const result=await evaluate(`(() => {
    const e=document.querySelector('textarea'),nodes=[...document.querySelectorAll('.file-text-selection')];
    window.firstSelectionNode=nodes[0];
    return {count:window.rangeMeasurements,rows:nodes.length,height:e.clientHeight,
      rects:nodes.map(n=>({top:parseFloat(n.style.top),height:parseFloat(n.style.height)})),value:e.value};
  })()`);
  assert(result.rows>5 && result.rows<80,"Only visible selected rows should have overlay nodes");
  assert(result.count<160,`An 8000-line selection must not measure every line (${result.count} ranges)`);
  assert(result.rects.every(r=>r.top>=0 && r.top+r.height<=result.height+.1));
  assert.equal(result.value,content);
  await evaluate("document.querySelector('textarea').scrollTop+=2;document.querySelector('textarea').dispatchEvent(new Event('scroll',{bubbles:true}))");
  await settle();
  assert(await evaluate("window.firstSelectionNode===document.querySelector('.file-text-selection')"),"Scrolling should reuse selection nodes");
  console.log(`PASS long document: ${result.rows} visible selection nodes, ${result.count} range measurements for 8000 selected lines; nodes reused on scroll`);
}
