import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1180, height: 900 } });
await p.goto('file://' + process.cwd() + '/demo.html');
await p.screenshot({ path: 'demo.png', fullPage: true });
await b.close();
