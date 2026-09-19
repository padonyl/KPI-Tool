// Když se řídké sektory neslučují, závisí dostupnost srovnání na tom,
// jestli zákazníky sbíráme roztroušeně, nebo v hloučcích po oborech.
const ROZPTYL = [["machinery",.30],["automotive",.20],["other",.15],
  ["food_bev",.12],["electronics",.12],["chemicals",.06],["pharma",.05]];
// Cílený lov ve dvou oborech (komory, oborové asociace, reference).
const CILENE  = [["machinery",.45],["automotive",.35],["other",.06],
  ["food_bev",.05],["electronics",.05],["chemicals",.02],["pharma",.02]];

const los = (r) => { let x=Math.random(); for (const [k,p] of r) if ((x-=p)<=0) return k; return r.at(-1)[0]; };

function pokryti(n, k, rozdeleni, opak = 2000) {
  let s = 0;
  for (let i=0;i<opak;i++) {
    const b = new Map(), f = [];
    for (let j=0;j<n;j++) { const x = los(rozdeleni); f.push(x); b.set(x,(b.get(x)??0)+1); }
    s += f.filter((x)=>b.get(x)>=k).length/n;
  }
  return s/opak;
}

const N = [15,20,30,40,50,75];
for (const k of [5]) {
  console.log(`práh k=${k}, srovnání jen podle sektoru\n`);
  console.log("zákazníků:".padEnd(26)+N.map(n=>String(n).padStart(6)).join(""));
  console.log("roztroušeně (dle trhu)".padEnd(26)+N.map(n=>(pokryti(n,k,ROZPTYL)*100).toFixed(0).padStart(5)+"%").join(""));
  console.log("cíleně ve 2 oborech".padEnd(26)+N.map(n=>(pokryti(n,k,CILENE)*100).toFixed(0).padStart(5)+"%").join(""));
}
