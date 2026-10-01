import { createClient } from "@/lib/supabase/server";
import SupplierManager from "./supplier-manager";

export default async function ProveedoresPage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: businessTypes }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("business_types").select("id, name").eq("is_active", true).order("name"),
  ]);

  return <SupplierManager suppliers={suppliers ?? []} businessTypes={businessTypes ?? []} />;
}
