const ts=require(require('path').join(process.env.ROOT||process.cwd(),'node_modules/typescript'));const fs=require('fs'),path=require('path');
const ROOT=require('path').join(process.env.ROOT||process.cwd(),'app/services');const out=[];
const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts'))scan(p)}};
function scan(f){const src=fs.readFileSync(f,'utf8');const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true);
 const L=n=>sf.getLineAndCharacterOfPosition(n).line+1;
 const visit=(n,top)=>{
  let name=null;
  if(ts.isFunctionDeclaration(n)&&n.name&&n.body)name=n.name.text;
  else if(ts.isVariableDeclaration(n)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer))&&ts.isIdentifier(n.name))name=n.name.text;
  if(name){const node=n.initializer||n;out.push({f:path.relative(ROOT,f),name,lines:L(node.getEnd())-L(node.getStart())+1})}
  ts.forEachChild(n,c=>visit(c,false));};
 visit(sf,true);}
for(const d of ['report_v4','premium_report','report_builder'])walk(path.join(ROOT,d));
out.sort((a,b)=>b.lines-a.lines);
console.log('functions',out.length,'>100 lines:',out.filter(o=>o.lines>100).length,'>200:',out.filter(o=>o.lines>200).length,'>50:',out.filter(o=>o.lines>50).length);
for(const o of out.slice(0,18))console.log(String(o.lines).padStart(5),o.f,o.name);
