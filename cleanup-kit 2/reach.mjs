import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.env.ROOT||process.cwd();
const alias={'#adomin/':'app/adomin/','#controllers/':'app/controllers/','#exceptions/':'app/exceptions/','#models/':'app/models/','#models_pg/':'app/models_pg/','#mails/':'app/mails/','#services/':'app/services/','#listeners/':'app/listeners/','#events/':'app/events/','#jobs/':'app/jobs/','#middleware/':'app/middleware/','#validators/':'app/validators/','#providers/':'providers/','#policies/':'app/policies/','#abilities/':'app/abilities/','#database/':'database/','#start/':'start/','#tests/':'tests/','#config/':'config/','#contracts/':'contracts/','#constants/':'app/constants/','#schemas/':'app/schemas/','#utils/':'app/utils/'};
const files=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(['node_modules','build','tmp','.git'].includes(e.name))continue;walk(p)}else if(/\.(ts|js|cjs|mjs)$/.test(e.name))files.push(p)}};
walk(ROOT);
const set=new Set(files);
const resolve=(from,spec)=>{let base;
 if(spec.startsWith('.'))base=path.resolve(path.dirname(from),spec);
 else{const k=Object.keys(alias).find(a=>spec.startsWith(a));if(!k)return null;base=path.join(ROOT,alias[k]+spec.slice(k.length));}
 base=base.replace(/\.js$/,'');
 for(const c of [base+'.ts',base+'.js',base+'/index.ts',base]) if(set.has(c))return c;return null;};
const re=/(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)['"]([^'"]+)['"]/g;
const edges=new Map();
for(const f of files){const s=fs.readFileSync(f,'utf8');const out=new Set();let m;while((m=re.exec(s))){const r=resolve(f,m[1]);if(r)out.add(r)}edges.set(f,out)}

const scope=['app/services/report_v4/','app/services/premium_report/','app/services/report_builder/'].map(x=>path.join(ROOT,x));
const inScope=f=>scope.some(s=>f.startsWith(s));
const lines=f=>fs.readFileSync(f,'utf8').split('\n').length;
const reach=(roots)=>{const seen=new Set(roots);const st=[...roots];while(st.length){const f=st.pop();for(const t of edges.get(f)||[])if(!seen.has(t)){seen.add(t);st.push(t)}}return seen};
const v4=reach([path.join(ROOT,'app/services/report_v4/controller.ts')]);
const sc=files.filter(inScope);
const by=(pre)=>sc.filter(f=>f.startsWith(path.join(ROOT,pre)));
for(const g of ['app/services/report_v4/','app/services/premium_report/','app/services/report_builder/']){
 const all=by(g),used=all.filter(f=>v4.has(f));
 console.log(g,'total',all.length,'files',all.reduce((a,f)=>a+lines(f),0),'lines | reachable from v4:',used.length,'files',used.reduce((a,f)=>a+lines(f),0),'lines');
}
console.log('\nNOT needed by v4 (only legacy routes):');
for(const f of sc.filter(f=>!v4.has(f)&&!f.includes('/report_v4/')))console.log(lines(f),path.relative(ROOT,f));
console.log('\nreport_v4 files not reachable from v4 controller:');
for(const f of sc.filter(f=>!v4.has(f)&&f.includes('/report_v4/')))console.log(lines(f),path.relative(ROOT,f));
// also other outside files used by v4
const outside=[...v4].filter(f=>!inScope(f));
console.log('\noutside-scope files used by v4:',outside.length);
for(const f of outside)console.log(lines(f),path.relative(ROOT,f));
