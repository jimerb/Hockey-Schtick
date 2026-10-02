const { chromium } = require(process.argv[2]);
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => { throw error; });
  await page.route('**/art-inspection', route => route.fulfill({ contentType: 'text/html', body: '<style>body{margin:0;background:#081729}#host{width:100vw;height:100vh}</style><div id="host"></div>' }));
  await page.goto('http://127.0.0.1:5173/art-inspection');
  await page.evaluate(async () => {
    const { RinkView } = await import('/src/scene.ts');
    const T = await import('/node_modules/three/build/three.module.js');
    const art = await import('/src/art.ts'); const { hockeyGoal } = await import('/src/goal-art.ts');
    const view = new RinkView(document.getElementById('host'), true);
    const scene = view.scene;
    for (const child of [...scene.children]) if (!child.isLight) scene.remove(child);
    const plane = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshPhysicalMaterial({ color: 0x8ab6ce, roughness: .55, clearcoat: .2 }));
    plane.rotation.x = -Math.PI / 2; plane.position.y = -.01; plane.receiveShadow = true; scene.add(plane);
    window.fixture = { view, art, hockeyGoal, scene, T };
  });
  for (const kind of ['skater', 'goalie', 'net']) {
    await page.evaluate(kind => {
      const { view, art, hockeyGoal, scene, T } = window.fixture;
      if (window.model) scene.remove(window.model);
      const model = kind === 'net' ? hockeyGoal() : art.hockeyFigure(kind === 'goalie', 17).group;
      if (kind === 'net') model.position.z = 7.65;
      model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      scene.add(model); window.model = model;
      const camera = view.camera;
      if (kind === 'net') { camera.position.set(3.3, 3.0, 6); camera.lookAt(0, .65, -.4); }
      else { camera.position.set(kind === 'skater' ? 2.7 : 1.7, 2.5, 3.3); camera.lookAt(.25, .72, 0); }
      camera.aspect = 1; camera.updateProjectionMatrix();
      view.renderer.render(scene, camera);
    }, kind);
    await page.locator('canvas').screenshot({ path: `evidence/browser-${kind}.png` });
  }
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
