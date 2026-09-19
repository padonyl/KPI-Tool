// Kolik firem je potřeba, aby srovnání vůbec šlo ukázat?
// Rozdělení NENÍ rovnoměrné - proto simulace, ne k x počet buněk.
// Spustit: node scripts/kohorty.mjs

const SEKTOR = [["machinery",.30],["automotive",.20],["other_manufacturing",.15],
  ["food_bev",.12],["electronics",.12],["chemicals",.06],["pharma",.05]];
// Cílovka 50-500 zaměstnanců -> těžiště v medium/large.
const PASMO  = [["medium",.62],["large",.26],["small",.11],["micro",.01]];
const ZEME   = [["CZ",.85],["SK",.15]];

// Hrubší pásmo: cílovka 50-500 se stejně celá vejde do "50+".
const HRUBE = { micro: "do50", small: "do50", medium: "nad50", large: "nad50" };

const los = (r) => { let x = Math.random(); for (const [k,p] of r) { if ((x-=p) <= 0) return k; } return r[r.length-1][0]; };

// Podíl firem, které spadnou do buňky s aspoň k firmami (včetně sebe).
function pokryti(n, k, dims, opak = 600) {
  let s = 0;
  for (let i = 0; i < opak; i++) {
    const b = new Map(), firmy = [];
    for (let j = 0; j < n; j++) {
      const f = { sektor: los(SEKTOR), pasmo: los(PASMO), zeme: los(ZEME) };
      f.hrube = HRUBE[f.pasmo];
      const key = dims.map((d) => f[d]).join("|");
      firmy.push(key);
      b.set(key, (b.get(key) ?? 0) + 1);
    }
    s += firmy.filter((key) => b.get(key) >= k).length / n;
  }
  return s / opak;
}

const VARIANTY = [
  ["sektor + pásmo + země", ["sektor","pasmo","zeme"]],
  ["sektor + pásmo",        ["sektor","pasmo"]],
  ["sektor + hrubé pásmo",  ["sektor","hrube"]],
  ["sektor",                ["sektor"]],
];
const N = [15, 20, 25, 30, 40, 50, 75, 100];

for (const k of [3, 4, 5]) {
  console.log(`\n=== práh k = ${k} ===`);
  console.log("firem:".padEnd(24) + N.map((n)=>String(n).padStart(6)).join(""));
  for (const [nazev, dims] of VARIANTY) {
    console.log(nazev.padEnd(24) + N.map((n) => (pokryti(n,k,dims)*100).toFixed(0).padStart(5) + "%").join(""));
  }
}
