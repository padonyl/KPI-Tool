# Testovací dataset — Seznam materiálových pohybů (ekvivalent SAP MB51)

Soubor: `sap-mb51-materialove-pohyby.csv`
Generuje: `node scripts/generuj-sap-pohyby.mjs [pocet-mesicu]`
Ověřuje: `node --experimental-strip-types scripts/over-sap-dataset.mjs`

## Co to je

Výpis materiálových pohybů výrobní firmy za 5 měsíců (leden–květen 2026),
strukturou odpovídá transakci **MB51** v SAP.

**Jedna odchylka od skutečného MB51, ať je to řečené rovnou:** reálná MB51
neobsahuje tržby ani režii — ta zná jen množství a skladovou hodnotu. Aby
šlo z *jednoho* souboru spočítat tržby, marži i zisk, jsou tu navíc tři
sloupce (`Tržba bez DPH`, `COGS`, `Režie`), které by v praxi přibyly
napojením na fakturaci (VBRK/VBRP) přes vlastní report nebo SAP Query.
Jinak je struktura věrná.

## Rozsah

| | |
|---|---|
| Řádků | 3 878 |
| Sloupců | 26 |
| Vstupních materiálů | 300 |
| Hotových výrobků | 50 |
| Výrobních zakázek | 235 |
| Období | 05.01.2026 – 29.05.2026 (jen pracovní dny) |

## Tok, který data popisují

```
101  nákup            → materiál na sklad 0001      1 655 řádků
261  výdej do výroby  → ze skladu do zakázky        1 475 řádků
551  šrot             → zmetky z výroby                21 řádků
131  příjem z výroby  → hotový výrobek na sklad 0003   235 řádků
601  prodej           → výdej zákazníkovi              475 řádků
102  storno příjmu    → opravy                          17 řádků
```

Dataset je **konzistentní**: nic se nevydá dřív, než se přijme, nic se
neprodá dřív, než se vyrobí, a žádný sklad nejde do mínusu. Díky tomu se
spočítaná čísla dají odsouhlasit.

## Sloupce

**Rozměry (podle čeho se dá rozpadat):** `Závod`, `Sklad`, `Materiál`,
`Text materiálu`, `Skupina materiálu`, `Druh pohybu`, `Text druhu pohybu`,
`Výrobní zakázka`, `Dodavatel`, `Odběratel`, `Šarže`, `Uživatel`,
`Nákladové středisko`, `ZMJ`, `S/H`, `Měna`

**Čísla:** `Množství` (záporné u výdejů), `Cena za MJ`, `Hodnota pohybu`,
`Tržba bez DPH`, `COGS`, `Režie`

**Datum:** `Datum zaúčtování` ← tenhle sloupec zvol v šabloně jako datový.
(`Datum dokladu` je druhé datum, běžně o pár dní dřív.)

`Tržba bez DPH`, `COGS` a `Režie` jsou vyplněné **jen u pohybu 601**
(prodej) — u ostatních řádků jsou prázdné. Prostý součet přes celý sloupec
tedy dá správný výsledek i bez filtru.

## Kontrolní součty

Tohle musí appka spočítat. Když vyjde něco jiného, je chyba v nástroji,
ne v datech:

| Ukazatel | Hodnota |
|---|---|
| Tržby bez DPH | 43 763 466 Kč |
| COGS | 30 654 309 Kč |
| Režie | 8 809 741 Kč |
| Hrubý zisk | 13 109 157 Kč |
| **Hrubá marže** | **30,0 %** |
| Čistý zisk | 4 299 416 Kč |
| **Čistá marže** | **9,8 %** |

Vzorce: `hrubá marže = (Tržba − COGS) / Tržba`,
`čistý zisk = Tržba − COGS − Režie`

## Co je v datech schválně schované

Dataset není plochý — jsou v něm nástrahy, které má analytika najít:

1. **Odběratel s trvalou slevou** — *Hella Autotechnik Nova* má marži
   **19,5 %** proti průměru 30 %. Odhalí rozpad tržeb a COGS po odběrateli.
2. **Tři ztrátové výrobky** — *Skříň rozvaděče F976* má marži **2,4 %**,
   dál *Kryt převodovky B587* (6,7 %) a *Převodovka šneková F508* (9,1 %).
3. **Skok ve zmetkovitosti** — hodnota šrotu v **březnu 11 857 Kč** proti
   cca 0,7–4,5 tis. v ostatních měsících.
4. **Zdražení oceli od dubna** o 18 % — vidět na `Cena za MJ` u skupiny
   *Ocel* v pohybech 101.

## Jak to nahrát

1. `/templates/new`, nahraj CSV.
2. Datový sloupec: **Datum zaúčtování**, období **měsíc**.
3. KPI namapuj přes vzorce, např.:
   - *Tržby* = součet `Tržba bez DPH`
   - *Hodnota reklamací / šrot* = součet `Hodnota pohybu` s filtrem
     `Druh pohybu` = `551`
   - *Celkové výrobní náklady* = součet `COGS`
4. Zapni **„Ukládat řádky pro rozpad do detailu"** — bez toho nebude
   proklik na čem stavět.

Se zapnutým ukládáním řádků se uloží všech 3 878 řádků, takže se rovnou
vyzkouší i stránkování rozpadu (PostgREST vrací po 1 000 řádcích).

## Formát

Středníkem oddělené CSV, UTF-8 s BOM, desetinná **čárka**, datum
**DD.MM.RRRR**. Vědomě **bez oddělovačů tisíců** — appka čte `1.234,56`
špatně (tečku bere jako tisíce), zatímco `1234,56` přečte správně.
