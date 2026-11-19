// Grava os sprites do escorpião: node tools/bake-escorpiao.cjs [anims]  (com `npx vite --port 5199` rodando)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = path.join(__dirname, '../src/assets/sprites/escorpiao');
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:5199/tools/bake-escorpiao.html?go=' + (process.argv[2] || ''));
  await p.waitForFunction('window.done', null, { timeout: 0 });
  const err = await p.evaluate('window.__bakeErr');
  if (err) { console.log(err); process.exit(1); }
  const r = await p.evaluate('window.__bake');
  fs.mkdirSync(out, { recursive: true });
  for (const [k, url] of Object.entries(r.files)) fs.writeFileSync(path.join(out, k + '.webp'), Buffer.from(url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(out, 'sprites.json'), JSON.stringify(r.meta, null, 1));
  console.log(JSON.stringify(r.meta));
  await b.close();
})();
