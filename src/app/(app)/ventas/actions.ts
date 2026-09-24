"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getBusinessId() {
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

export async function findSaleByDate(saleDate: string) {
  const { supabase } = await getBusinessId();
  const { data } = await supabase.from("sales").select("id").eq("sale_date", saleDate).is("voided_at", null).maybeSingle();
  return data?.id ?? null;
}

export async function createSale(formData: FormData) {
  const { supabase, businessId, userId } = await getBusinessId();

  const saleDate = String(formData.get("sale_date") ?? "");
  if (!saleDate) throw new Error("La fecha es obligatoria");

  const cash = Number(formData.get("cash_amount") ?? 0);
  const card = Number(formData.get("card_amount") ?? 0);
  const transfer = Number(formData.get("transfer_amount") ?? 0);
  const posTotalRaw = formData.get("pos_reported_total");

  for (const [label, v] of [["Efectivo", cash], ["Tarjeta", card], ["Transferencia", transfer]] as const) {
    if (Number.isNaN(v) || v < 0) throw new Error(`${label} debe ser un número mayor o igual a cero`);
  }

  const { error } = await supabase.from("sales").insert({
    business_id: businessId,
    sale_date: saleDate,
    num_orders: Number(formData.get("num_orders") ?? 0),
    num_products: Number(formData.get("num_products") ?? 0),
    cash_amount: cash,
    card_amount: card,
    transfer_amount: transfer,
    pos_reported_total: posTotalRaw ? Number(posTotalRaw) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: userId,
    updated_by: userId,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe una venta para esa fecha. Edítala en vez de crear otra.");
    throw new Error(error.message);
  }
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
}

export async function updateSale(id: string, formData: FormData) {
  const { supabase, userId } = await getBusinessId();

  const cash = Number(formData.get("cash_amount") ?? 0);
  const card = Number(formData.get("card_amount") ?? 0);
  const transfer = Number(formData.get("transfer_amount") ?? 0);
  const posTotalRaw = formData.get("pos_reported_total");

  for (const [label, v] of [["Efectivo", cash], ["Tarjeta", card], ["Transferencia", transfer]] as const) {
    if (Number.isNaN(v) || v < 0) throw new Error(`${label} debe ser un número mayor o igual a cero`);
  }

  const { error } = await supabase
    .from("sales")
    .update({
      num_orders: Number(formData.get("num_orders") ?? 0),
      num_products: Number(formData.get("num_products") ?? 0),
      cash_amount: cash,
      card_amount: card,
      transfer_amount: transfer,
      pos_reported_total: posTotalRaw ? Number(posTotalRaw) : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_by: userId,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
}

export async function voidSale(id: string, reason: string) {
  const { supabase, userId } = await getBusinessId();
  const { error } = await supabase
    .from("sales")
    .update({ voided_at: new Date().toISOString(), void_reason: reason || null, updated_by: userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
}
