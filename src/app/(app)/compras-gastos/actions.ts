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

export async function checkPossibleDuplicate(movementDate: string, supplierId: string | null, amount: number) {
  if (!supplierId || !movementDate || !amount) return false;
  const { supabase } = await getContext();
  const { data } = await supabase
    .from("financial_movements")
    .select("id")
    .eq("movement_date", movementDate)
    .eq("supplier_id", supplierId)
    .eq("amount", amount)
    .is("voided_at", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function createSupplierInline(name: string) {
  const { supabase, businessId } = await getContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre es obligatorio");
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ business_id: businessId, name: trimmed })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un proveedor con ese nombre.");
    throw new Error(error.message);
  }
  revalidatePath("/compras-gastos");
  return data;
}

export async function createMovement(formData: FormData) {
  const { supabase, businessId, userId } = await getContext();

  const movementDate = String(formData.get("movement_date") ?? "");
  const movementTypeId = String(formData.get("movement_type_id") ?? "");
  const paymentMethodId = String(formData.get("payment_method_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const supplierId = String(formData.get("supplier_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;

  if (!movementDate) throw new Error("La fecha es obligatoria");
  if (!movementTypeId) throw new Error("El tipo de movimiento es obligatorio");
  if (!paymentMethodId) throw new Error("La forma de pago es obligatoria");
  if (!amount || amount <= 0) throw new Error("El monto debe ser mayor a cero");

  const { data, error } = await supabase
    .from("financial_movements")
    .insert({
      business_id: businessId,
      movement_date: movementDate,
      movement_type_id: movementTypeId,
      supplier_id: supplierId,
      category_id: categoryId,
      payment_method_id: paymentMethodId,
      amount,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/compras-gastos");
  revalidatePath("/dashboard");
  return data.id as string;
}

export async function attachReceipt(movementId: string, storagePath: string, fileType: string) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("attachments").insert({
    financial_movement_id: movementId,
    file_url: storagePath,
    file_type: fileType,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/compras-gastos");
}

export async function voidMovement(id: string, reason: string) {
  const { supabase, userId } = await getContext();
  const { error } = await supabase
    .from("financial_movements")
    .update({ voided_at: new Date().toISOString(), void_reason: reason || null, updated_by: userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/compras-gastos");
  revalidatePath("/dashboard");
}

export async function getReceiptUrl(storagePath: string) {
  const { supabase } = await getContext();
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(storagePath, 60 * 30);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
