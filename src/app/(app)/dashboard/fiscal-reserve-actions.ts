"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("business_id")
    .eq("id", auth.user.id)
    .single();
  if (!profile) throw new Error("Perfil de negocio no encontrado");
  return { supabase, businessId: profile.business_id as string, userId: auth.user.id };
}

export async function setFiscalReserveStatus(periodMonth: string, isReserved: boolean) {
  const { supabase, businessId, userId } = await getContext();
  const { error } = await supabase.from("fiscal_reserve_status").upsert(
    {
      business_id: businessId,
      period_month: periodMonth,
      is_reserved: isReserved,
      reserved_at: isReserved ? new Date().toISOString() : null,
      reserved_by: isReserved ? userId : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,period_month" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
