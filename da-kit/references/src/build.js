const fs = require('fs'), path = require('path');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/\.(html|png)$/.test(f)) fs.unlinkSync(path.join(out, f));
for (const [name, fn] of require('./pages')) {
  const html = fn();
  fs.writeFileSync(path.join(out, name + '.html'), html);
  console.log(name, html.length);
}
