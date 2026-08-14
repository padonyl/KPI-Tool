# Modelové datasety pro slotový model výpočtu KPI

Tři soubory na vyzkoušení nového způsobu tvorby šablony (`/templates/new`).
U každého je uvedeno, **co má vyjít** — po namapování se to musí shodovat
s náhledem v aplikaci, jinak je někde chyba.

Všechny soubory používají středník jako oddělovač a české datum (`DD.MM.RRRR`).
Ověřeno, že si to parser rozpozná sám.

---

## 1. `prodej-marze.csv` → KPI **Hrubá marže**

Hlavní testovací případ. Vzorec `(Tržby − Náklady na prodané zboží) / Tržby × 100`
má dva sloty a soubor je schválně nemá připravené — COGS se musí poskládat ze tří
sloupců, včetně jednoho odečítaného.

**Jak namapovat:**

| Slot | Sloupce | Agregace |
|---|---|---|
| Tržby | `+ Tržba` | Sečíst |
| Náklady na prodané zboží | `+ Náklady výroby`, `+ Standardní doprava`, `− Sleva od dopravce` | Sečíst |

**Co musí vyjít:**

| Období | Tržby | Náklady | Hrubá marže |
|---|---|---|---|
| 2026-01-31 | 935 000 | 638 200 | **31,74 %** |
| 2026-02-28 | 893 000 | 648 500 | **27,38 %** |
| 2026-03-31 | 1 150 000 | 735 700 | **36,03 %** |

> **Pozor na jeden detail:** průměr marží spočítaných po jednotlivých řádcích ledna
> by dal 31,44 %, ne 31,74 %. Rozdíl je důkaz, že se dělí až nad součty za období,
> ne po řádcích — což je metodicky správně a je to důvod, proč dělení zůstává
> v rukou aplikace a ne uživatele.

---

## 2. `sklad-zasoby.csv` → KPI **Stav zásob**

Reálný případ, kvůli kterému slotový model vznikl: report zásob po materiálech
a šaržích, kde je hodnota rozdělená do tří sloupců. Některé buňky jsou schválně
prázdné (prázdná = 0).

**Jak namapovat:**

| Slot | Sloupce | Agregace |
|---|---|---|
| Hodnota zásob | `+ Volná zásoba`, `+ Kontrola kvality`, `+ Blokováno` | Sečíst |

**Co musí vyjít:**

| Období | Hodnota zásob |
|---|---|
| 2026-01-31 | **598 000** |
| 2026-02-28 | **537 000** |
| 2026-03-31 | **559 000** |

---

## 4. `dodavky-otif.csv` → KPI **OTIF zákazníkům**

Ověřuje, že OTIF projde **přes šablonu** — tedy že starší přímý tok
`/upload/deliveries` už není k ničemu potřeba. OTIF se nemapuje na plátně
jako ostatní KPI: je to jediné KPI, které se nepočítá aritmetikou nad
sloupci, ale vyhodnocením podmínky na každém řádku (dorazilo včas? v plném
množství?), takže dostaneš jiný formulář.

**Jak namapovat:**

| Pole | Sloupec |
|---|---|
| Slíbený termín | `Slíbený termín` |
| Reálný termín | `Skutečné dodání` |
| Slíbené množství | `Objednáno (ks)` |
| Reálné množství | `Dodáno (ks)` |
| Tolerance termínu | **2** dny |
| Min. % množství | **95** % |

> Sloupec s datem si při zakládání šablony zvol libovolně (nebo „soubor nemá
> datum") — OTIF si období bere ze slíbeného termínu, ne z nastavení šablony.

**Co musí vyjít:**

| Období | OTIF |
|---|---|
| 2026-01-31 | **75 %** |
| 2026-02-28 | **60 %** |
| 2026-03-31 | **83,3 %** |

> **Kontrola, že tolerance opravdu fungují:** kdybys je nechal na výchozích
> hodnotách (0 dní / 100 %), vyšlo by **25 / 20 / 50 %**. Když vidíš tahle
> čísla, tolerance se nepropsaly.

Do tabulky `deliveries` se u toho uloží všech 19 řádků — ty jsou podkladem
pro budoucí proklik do detailu (viz nápadník).

---

## 3. `pohyby-erp.csv` → KPI **Tržby**

Export pohybů materiálu z ERP — jeden soubor, víc typů řádků. Testuje filtr:
do tržeb patří jen řádky s `Typ pohybu = prodej`, nákupy a výrobu je nutné
vynechat.

**Jak namapovat:**

| Slot | Sloupce | Filtr | Agregace |
|---|---|---|---|
| Tržby | `+ Částka` | `Typ pohybu` = `prodej` | Sečíst |

**Co musí vyjít:**

| Období | Tržby |
|---|---|
| 2026-01-31 | **515 000** |
| 2026-02-28 | **570 000** |
| 2026-03-31 | **612 000** |

Kdyby se filtr nezapnul, vyšlo by výrazně víc (připočetly by se nákupy) — dobrá
kontrola, že filtr opravdu funguje.
