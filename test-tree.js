async function test() {
  const res = await fetch('http://localhost:7001/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'ui.navigate', arguments: { url: 'http://localhost:5173/login' }}
    })
  });
  await res.text();
  await new Promise(r => setTimeout(r, 2000));
  
  const {chromium} = require('playwright');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:5173/login');
  
  const tree = await page.accessibility.snapshot();
  console.log(JSON.stringify(tree, null, 2));
  
  await browser.close();
}
test().catch(e => console.error('Error:', e.message));
