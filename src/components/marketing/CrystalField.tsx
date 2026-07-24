// Dekorativní pozadí ze stejného tvaru jako logo (C4 broušený drahokam),
// v různých velikostech/průhlednostech. Čistě texturální - aria-hidden.
export function CrystalField({ variant = "light" }: { variant?: "light" | "dark" }) {
  const stroke = variant === "dark" ? "#8fb4f5" : "#0e2050";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
    >
      <polygon points="80,40 140,72 158,132 108,178 48,164 12,108 34,58" fill="currentColor" stroke={stroke} strokeWidth="1" className="text-brand" />
      <polygon points="680,260 730,286 744,336 704,374 656,362 626,316 646,274" fill="currentColor" stroke={stroke} strokeWidth="1" className="text-brand-light" />
      <polygon points="380,340 420,362 432,404 400,436 360,426 336,388 352,354" fill="currentColor" stroke={stroke} strokeWidth="1" className="text-brand" />
      <polygon points="620,40 650,58 658,90 634,114 604,106 586,78 598,52" fill="currentColor" stroke={stroke} strokeWidth="1" className="text-brand-light" />
    </svg>
  );
}
