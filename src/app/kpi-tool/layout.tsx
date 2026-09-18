import { ProductNav } from "@/components/marketing/ProductNav";
import { createClient } from "@/lib/supabase/server";

/**
 * Vše pod /kpi-tool/* je produktová vrstva - dostává vlastní podnavigaci.
 * Až tool dostane vlastní název a doménu, odřízne se celá tahle větev najednou.
 */
export default async function KpiToolLayout({ children }: { children: React.ReactNode }) {
  // Jen kvůli popisku tlačítka („Přihlásit se" vs „Do aplikace"). Stránky
  // pod /kpi-tool jsou stejně dynamické, protože horní lišta se na
  // přihlášení ptá taky — nepřibývá tím tedy statická stránka navíc.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <ProductNav prihlasen={!!user} />
      {children}
    </>
  );
}
