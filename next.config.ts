import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web se 2026-08-14 přeskládal: padonyl.com je o FIRMĚ, nástroj žije pod
  // /kpi-tool/*. Staré adresy musí dál fungovat - odkazují na ně už vydané
  // dokumenty (ToS, Privacy, data policy, FAQ pro zákazníky) i cokoliv, co
  // si někdo uložil. Trvalé přesměrování, ne dočasné, aby se přepsaly i
  // odkazy ve vyhledávačích.
  async redirects() {
    return [
      { source: "/pricing", destination: "/kpi-tool/pricing", permanent: true },
      { source: "/faq", destination: "/kpi-tool/faq", permanent: true },
      { source: "/terms", destination: "/kpi-tool/terms", permanent: true },
      { source: "/privacy", destination: "/kpi-tool/privacy", permanent: true },
    ];
  },
};

export default nextConfig;
