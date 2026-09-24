"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const NEXT_STATUS: Record<string, string> = {
  pendiente: "capturado",
  capturado: "conciliado",
  conciliado: "cerrado",
};

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

export async function advanceDayStatus(operationDate: string, currentStatus: string) {
  const { supabase, businessId, userId } = await getContext();
  const nextStatus = NEXT_STATUS[currentStatus];
  if (!nextStatus) throw new Error("Este día ya está cerrado.");

  const payload: Record<string, unknown> = {
    business_id: businessId,
    operation_date: operationDate,
    status: nextStatus,
  };
  if (nextStatus === "cerrado") {
    payload.closed_by = userId;
    payload.closed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("operation_days")
    .upsert(payload, { onConflict: "business_id,operation_date" });

  if (error) throw new Error(error.message);
  revalidatePath("/cierre");
  revalidatePath("/dashboard");
}

export async function reopenDay(operationDate: string) {
  const { supabase, businessId } = await getContext();
  const { error } = await supabase
    .from("operation_days")
    .update({ status: "conciliado", closed_by: null, closed_at: null })
    .eq("business_id", businessId)
    .eq("operation_date", operationDate);
  if (error) throw new Error(error.message);
  revalidatePath("/cierre");
  revalidatePath("/dashboard");
}
