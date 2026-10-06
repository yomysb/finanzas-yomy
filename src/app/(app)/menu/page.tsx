import { createClient } from "@/lib/supabase/server";
import MenuManager from "./menu-manager";

export default async function MenuPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("menu_products")
      .select("id, name, category_id, production_cost, sale_price, tpv_commission_pct, target_margin_pct, is_active")
      .order("name"),
    supabase.from("menu_categories").select("id, name, is_active").order("name"),
  ]);

  return <MenuManager products={products ?? []} categories={categories ?? []} />;
}
