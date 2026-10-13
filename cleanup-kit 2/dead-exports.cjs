const ts=require(require('path').join(process.env.ROOT||process.cwd(),'node_modules/typescript'));
const fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||process.cwd();
const all=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(['node_modules','build','tmp','.git'].includes(e.name))continue;walk(p)}else if(/\.(ts|js|cjs|mjs)$/.test(e.name))all.push(p)}};
walk(ROOT);
const text=new Map(all.map(f=>[f,fs.readFileSync(f,'utf8')]));
const scope=['app/services/report_v4/','app/services/premium_report/','app/services/report_builder/'];
const sc=all.filter(f=>scope.some(s=>f.startsWith(path.join(ROOT,s)))&&f.endsWith('.ts'));
const isTest=f=>f.startsWith(path.join(ROOT,'tests/'));
const out=[];
for(const f of sc){
  const src=text.get(f);const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true);
  const add=(name,node,kind)=>{const s=sf.getLineAndCharacterOfPosition(node.getStart()).line+1,e=sf.getLineAndCharacterOfPosition(node.getEnd()).line+1;out.push({f,name,kind,s,e,lines:e-s+1})};
  sf.forEachChild(n=>{
    const exp=n.modifiers&&n.modifiers.some(m=>m.kind===ts.SyntaxKind.ExportKeyword);
    if(!exp)return;
    if(ts.isVariableStatement(n)){for(const d of n.declarationList.declarations){if(ts.isIdentifier(d.name))add(d.name.text,n,'const')}}
    else if(ts.isFunctionDeclaration(n)&&n.name)add(n.name.text,n,'function');
    else if(ts.isClassDeclaration(n)&&n.name)add(n.name.text,n,'class');
    else if(ts.isTypeAliasDeclaration(n)||ts.isInterfaceDeclaration(n))add(n.name.text,n,'type');
    else if(ts.isEnumDeclaration(n))add(n.name.text,n,'enum');
  });
}
const res=[];
for(const o of out){
  const re=new RegExp('\\b'+o.name.replace(/\$/g,'\\$')+'\\b','g');
  let ownRefs=(text.get(o.f).match(re)||[]).length-1; // minus declaration
  let ext=0,extTest=0;
  for(const [g,t] of text){if(g===o.f)continue;if(re.test(t)){isTest(g)?extTest++:ext++}re.lastIndex=0}
  res.push({...o,ownRefs,ext,extTest});
}
const dead=res.filter(r=>r.ext===0&&r.extTest===0&&r.ownRefs<=0);
const unusedExport=res.filter(r=>r.ext===0&&r.extTest===0&&r.ownRefs>0);
const testOnly=res.filter(r=>r.ext===0&&r.extTest>0);
const sum=a=>a.reduce((x,r)=>x+r.lines,0);
console.log('exports total',res.length,'lines',sum(res));
console.log('DEAD (no reference anywhere):',dead.length,'symbols',sum(dead),'lines');
console.log('export unused outside file (used internally only):',unusedExport.length,'symbols',sum(unusedExport),'lines (export keyword removable)');
console.log('used only by tests:',testOnly.length,'symbols',sum(testOnly),'lines');
const byFile={};for(const r of dead){const k=path.relative(ROOT,r.f);(byFile[k]=byFile[k]||[]).push(r)}
for(const [k,v] of Object.entries(byFile).sort((a,b)=>sum(b[1])-sum(a[1])))console.log(sum(v).toString().padStart(5),k,v.map(r=>r.name+'('+r.lines+')').join(', '));
fs.writeFileSync((process.env.OUT||'.')+'/dead-exports.json',JSON.stringify({dead,testOnly:testOnly.map(r=>({name:r.name,f:path.relative(ROOT,r.f),lines:r.lines}))},null,1));
