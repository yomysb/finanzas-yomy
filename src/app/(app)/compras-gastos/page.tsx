import { createClient } from "@/lib/supabase/server";
import MovementManager from "./movement-manager";

export default async function ComprasGastosPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("business_id")
    .eq("id", auth.user!.id)
    .single();

  const [{ data: movements }, { data: movementTypes }, { data: suppliers }, { data: categories }, { data: paymentMethods }] =
    await Promise.all([
      supabase
        .from("financial_movements")
        .select(
          "id, movement_date, amount, notes, voided_at, movement_type:movement_types(name), supplier:suppliers(name), category:expense_categories(name), payment_method:payment_methods(name), attachments(id, file_url, file_type)"
        )
        .order("movement_date", { ascending: false })
        .limit(60),
      supabase
        .from("movement_types")
        .select("id, code, name, requires_supplier, requires_category")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
      supabase.from("payment_methods").select("id, name").eq("is_active", true).order("name"),
    ]);

  return (
    <MovementManager
      businessId={profile?.business_id ?? ""}
      movements={(movements as never) ?? []}
      movementTypes={movementTypes ?? []}
      suppliers={suppliers ?? []}
      categories={categories ?? []}
      paymentMethods={paymentMethods ?? []}
    />
  );
}
