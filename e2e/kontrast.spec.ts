import { test, expect } from "@playwright/test";
import { VEREJNE_STRANKY } from "./stranky";

// ============================================================
// Kontrola čitelnosti textu — měří skutečný kontrast, ne screenshot.
//
// PROČ NE SCREENSHOT: funkční test i vizuální snímek tuhle třídu chyb
// neodhalí sám od sebe. Text v DOM je, nadpis existuje, odkaz funguje -
// jen ho není vidět. Jediné, co to pozná strojově, je spočítat poměr
// jasu textu vůči pozadí pod ním.
//
// Chytá přesně chybu z 2026-08-22: bg-brand-ink + text-white, kde se
// --brand-ink v tmavém režimu překlopil na #eef0ee.
// ============================================================

/** WCAG AA: 4.5 pro běžný text, 3.0 pro velký. Držíme se velkého prahu,
 *  ať test hlásí jen skutečnou nečitelnost, ne hraniční odstíny. */
const PRAH = 3.0;

type Nalez = {
  text: string;
  selektor: string;
  pomer: number;
  barva: string;
  pozadi: string;
};

test.describe("Čitelnost textu", () => {
  for (const stranka of VEREJNE_STRANKY) {
    test(`${stranka.cesta} — text je čitelný vůči svému pozadí`, async ({ page }) => {
      await page.goto(stranka.cesta);
      await page.waitForLoadState("networkidle");

      const nalezy: Nalez[] = await page.evaluate((prah) => {
        function parseRgb(s: string): [number, number, number, number] | null {
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
          if (parts.length < 3 || parts.some(Number.isNaN)) return null;
          return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
        }

        /** Gradient nemá backgroundColor. Vezmeme z něj první barvu jako
         *  přiblížení - lepší než spadnout až na pozadí stránky a hlásit
         *  falešný poplach. */
        function prvniBarvaGradientu(img: string): [number, number, number, number] | null {
          if (!img || img === "none") return null;
          const m = img.match(/rgba?\([^)]+\)/);
          return m ? parseRgb(m[0]) : null;
        }

        function efektivniPozadi(el: Element): [number, number, number] {
          let uzel: Element | null = el;
          while (uzel) {
            const st = getComputedStyle(uzel);
            const barva = parseRgb(st.backgroundColor);
            if (barva && barva[3] > 0.5) return [barva[0], barva[1], barva[2]];
            const grad = prvniBarvaGradientu(st.backgroundImage);
            if (grad && grad[3] > 0.5) return [grad[0], grad[1], grad[2]];
            uzel = uzel.parentElement;
          }
          // Nikdo nic nenastavil - ber pozadí dokumentu.
          const telo = parseRgb(getComputedStyle(document.body).backgroundColor);
          return telo ? [telo[0], telo[1], telo[2]] : [255, 255, 255];
        }

        function jas([r, g, b]: [number, number, number]): number {
          const lin = [r, g, b].map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
        }

        function pomerKontrastu(a: [number, number, number], b: [number, number, number]) {
          const la = jas(a);
          const lb = jas(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        }

        function selektorPro(el: Element): string {
          const tag = el.tagName.toLowerCase();
          const cls = (el.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 3);
          return cls.length ? `${tag}.${cls.join(".")}` : tag;
        }

        const vysledky: Nalez[] = [];
        const vse = document.querySelectorAll("body *");

        for (const el of vse) {
          // Jen prvky s vlastním viditelným textem, ne obaly.
          const vlastniText = [...el.childNodes]
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? "")
            .join("")
            .trim();
          if (vlastniText.length < 2) continue;

          const st = getComputedStyle(el);
          if (st.visibility === "hidden" || st.display === "none") continue;
          if (Number(st.opacity) < 0.1) continue;

          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          const popredi = parseRgb(st.color);
          if (!popredi) continue;
          // Průhledný text je záměr (dekorace), neřešíme.
          if (popredi[3] < 0.5) continue;

          const pozadi = efektivniPozadi(el);
          const pomer = pomerKontrastu([popredi[0], popredi[1], popredi[2]], pozadi);

          if (pomer < prah) {
            vysledky.push({
              text: vlastniText.slice(0, 60),
              selektor: selektorPro(el),
              pomer: Math.round(pomer * 100) / 100,
              barva: st.color,
              pozadi: `rgb(${pozadi.join(", ")})`,
            });
          }
        }
        return vysledky;
      }, PRAH);

      const zprava = nalezy
        .map(
          (n) =>
            `  „${n.text}“ (${n.selektor}) — kontrast ${n.pomer}:1, ` +
            `text ${n.barva} na ${n.pozadi}`,
        )
        .join("\n");

      expect(
        nalezy,
        `Nečitelný text na ${stranka.cesta}:\n${zprava}\n` +
          `Nejčastější příčina: pozadí používá token, který se v tmavém režimu ` +
          `překlápí (--brand, --brand-ink), pod natvrdo bílým textem. ` +
          `Na plné plochy patří --brand-solid / --brand-deep.`,
      ).toEqual([]);
    });
  }
});
