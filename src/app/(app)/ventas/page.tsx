import { createClient } from "@/lib/supabase/server";
import SaleManager from "./sale-manager";

export default async function VentasPage() {
  const supabase = await createClient();
  const { data: sales } = await supabase
    .from("sales")
    .select("*")
    .order("sale_date", { ascending: false })
    .limit(60);

  return <SaleManager sales={sales ?? []} />;
}
