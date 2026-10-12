const { chromium } = require(process.argv[2]);
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-proxy-server'] });
  try {
    const page = await browser.newPage({ viewport:{width:1440,height:1000},deviceScaleFactor:1 });
    const errors=[]; page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    await page.route('**/src/main.ts*',async route=>{
      const response=await route.fetch(),body=await response.text(); assert.ok(body.includes('function qaState()'));
      await route.fulfill({response,body:body.replace('function qaState()','window.__rinkTest={sim,match,view,qaState,resume};\nfunction qaState()')});
    });
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'}); await page.waitForFunction(()=>!!window.__rinkTest);
    await page.keyboard.press('Enter'); await page.waitForTimeout(4000);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const geometry=await page.evaluate(async()=>{
      const {view,sim}=window.__rinkTest,T=await import('/node_modules/three/build/three.module.js');
      return view.offensePaddles.map((g,i)=>{
        const clone=g.clone();clone.position.set(0,0,0);clone.rotation.set(0,0,0);
        const blade=new T.Box3().setFromObject(clone),face=new T.Box3().setFromObject(view.offenseRestFaces[i]);
        return {tip:blade.max.x,width:blade.max.z-blade.min.z,faceMin:face.min.toArray(),faceMax:face.max.toArray(),angle:sim.offenseAngles[i]};
      });
    });
    for(const shape of geometry){assert.ok(Math.abs(shape.tip-2.54375)<.002);assert.ok(shape.faceMax[2]>-3.2&&shape.faceMin[2]<-5.65);assert.equal(shape.angle,Math.PI/2);}
    await page.evaluate(()=>document.querySelector('#curtain').classList.add('hidden'));
    await page.screenshot({path:'evidence/upper25-recessed.png'});
    // Real swept shape contacts with the test figure parked on its normal straight slot.
    const checking=await page.evaluate(()=>{
      const {sim,match}=window.__rinkTest;
      window.__rinkTest.resume();
      match.prepare('normal',42);match.phase='playing';sim.downhill=0;sim.place({x:0,y:.11,z:2},{x:0,y:0,z:0});
      const skater=match.team.skaters[0];skater.z=skater.previousZ=-4.35;skater.angle=skater.previousAngle=Math.PI;
      skater.body.setTranslation({x:match.team.lanes[0].x,y:0,z:skater.z},true);skater.body.setNextKinematicTranslation({x:match.team.lanes[0].x,y:0,z:skater.z});
      skater.body.setRotation({x:0,y:-1,z:0,w:0},true);skater.body.setNextKinematicRotation({x:0,y:-1,z:0,w:0});
      sim.shootOffense(0);sim.shootOffense(1);
      for(let i=0;i<12;i++){sim.step();match.team.postStep();}
      return {event:match.team.lastCheck,stage:skater.stage,checkSounds:window.__rinkTest.qaState().checkSounds,physical:skater.body.translation(),angles:sim.offenseAngles};
    });
    assert.equal(checking.event.paddle,'upper');assert.equal(checking.stage,'checked');assert.ok(checking.checkSounds>0);assert.equal(checking.physical.x,Math.fround(-2.8));
    await page.waitForTimeout(100);await page.screenshot({path:'evidence/upper25-extended-check.png'});
    assert.equal(errors.length,0);
    fs.writeFileSync('evidence/upper25-browser.json',JSON.stringify({date:new Date().toISOString(),geometry,checking,errors},null,2));
    console.log(JSON.stringify({geometry,checking,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
