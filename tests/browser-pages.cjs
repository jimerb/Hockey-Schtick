const { chromium } = require(process.argv[2]);
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

(async () => {
  let server;
  let url = process.argv[3];
  const live = !!url;
  const evidenceRoot = process.argv[4] || 'evidence';
  if (!url) {
    const root = path.resolve('dist'), prefix = '/Hockey-Schtick/';
    server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      if (!pathname.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
      const file = path.resolve(root,pathname.slice(prefix.length) || 'index.html');
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
      const type = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.wasm':'application/wasm' }[path.extname(file)] || 'application/octet-stream';
      response.writeHead(200,{'content-type':type}); fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    url = `http://127.0.0.1:${server.address().port}${prefix}`;
  }
  const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server'] });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    const errors=[], failedResponses=[];
    page.on('pageerror',e=>errors.push(String(e))); page.on('response',r=>{if(r.status()>=400)failedResponses.push({url:r.url(),status:r.status()});});
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#qa-state').textContent||'{}').settings?.version==='0.4.9');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>{const q=JSON.parse(document.querySelector('#qa-state').textContent||'{}');return q.phase==='playing'&&!q.paused;});
    await page.keyboard.down('a');await page.keyboard.down('l');
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#qa-state').textContent||'{}').offense?.held?.every(Boolean),undefined,{timeout:3000});
    const held=JSON.parse(await page.locator('#qa-state').textContent());
    assert.deepEqual(held.held,[true,true]);assert.equal(held.settings.offensePaddles.length,2.54375);
    await page.keyboard.up('a');await page.keyboard.up('l');
    await page.screenshot({path:path.join(evidenceRoot,live?'pages-live.png':'pages-local.png')});
    await page.locator('#settings').click();
    const practice=await page.locator('a.practice-link').getAttribute('href');
    assert.equal(practice,'./practice.html');
    await page.locator('a.practice-link').click();await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname,'/Hockey-Schtick/practice.html');
    const back=page.getByRole('link',{name:/Back to hockey match/});await back.click();await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname,'/Hockey-Schtick/');
    await page.waitForFunction(()=>!document.querySelector('#start').disabled);
    assert.equal(errors.length,0);assert.equal(failedResponses.length,0);
    const result={date:new Date().toISOString(),url,live,version:held.settings.version,paddleLength:held.settings.offensePaddles.length,pairedInputs:true,practiceRoundTrip:true,errors,failedResponses};
    fs.writeFileSync(path.join(evidenceRoot,live?'pages-live.json':'pages-local.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  } finally {await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
