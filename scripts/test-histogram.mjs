import { rozdeleni } from "../src/lib/histogram.ts";
let ok = 0, chyb = 0;
const z = (n, podm, d="") => { podm ? ok++ : chyb++; console.log((podm?"OK   ":"CHYBA")+" "+n+(d?"  ("+d+")":"")); };

// 1. součet košů = počet hodnot (nesmí se ztratit ani jedna)
for (const vzorek of [
  [1,2,3,4,5,6,7,8,9,10],
  [0.1,0.2,0.35,0.9,1.4],
  [-50,-10,0,10,50],
  [1000000,2000000,3500000],
  Array.from({length:300},(_,i)=>Math.sin(i)*100),
]) {
  const k = rozdeleni(vzorek);
  const suma = k.reduce((s,x)=>s+x.pocet,0);
  z("součet košů = "+vzorek.length, suma === vzorek.length, "vyšlo "+suma);
}

// 2. prázdný vstup
z("prázdný vstup vrátí []", rozdeleni([]).length === 0);
z("samé NaN vrátí []", rozdeleni([NaN, Infinity]).length === 0);

// 3. všechny hodnoty stejné
const stejne = rozdeleni([5,5,5]);
z("stejné hodnoty = 1 koš se všemi", stejne.length === 1 && stejne[0].pocet === 3);

// 4. hezká šířka
const k1 = rozdeleni(Array.from({length:100},(_,i)=>i)); // 0..99
const sirka = k1[0].do - k1[0].od;
z("šířka koše je hezké číslo", [1,2,5,10,20,50].includes(sirka), "šířka "+sirka);

// 5. hranice: hodnota rovná `do` patří do DALŠÍHO koše, ne do obou
const k2 = rozdeleni([0,10,20,30], 4);
const dvakrat = k2.filter(x=>x.pocet>0).reduce((s,x)=>s+x.pocet,0);
z("hraniční hodnoty se nezapočítají dvakrát", dvakrat === 4, "napočítáno "+dvakrat);

// 6. koše na sebe navazují bez děr a bez překryvu
const k3 = rozdeleni([1,2,3,4,5,50]);
let navazuje = true;
for (let i=1;i<k3.length;i++) if (Math.abs(k3[i].od - k3[i-1].do) > 1e-9) navazuje = false;
z("koše na sebe navazují", navazuje);

// 7. maximum má kam spadnout
const k4 = rozdeleni([0, 7]);
z("maximum spadlo do některého koše", k4.reduce((s,x)=>s+x.pocet,0) === 2);

console.log("\n"+ok+" prošlo, "+chyb+" selhalo.");
process.exit(chyb?1:0);
