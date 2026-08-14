import { ProductNav } from "@/components/marketing/ProductNav";

/**
 * Vše pod /kpi-tool/* je produktová vrstva - dostává vlastní podnavigaci.
 * Až tool dostane vlastní název a doménu, odřízne se celá tahle větev najednou.
 */
export default function KpiToolLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProductNav />
      {children}
    </>
  );
}
