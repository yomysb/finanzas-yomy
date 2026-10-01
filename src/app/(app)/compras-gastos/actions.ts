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
  const taxStatus = String(formData.get("tax_status") ?? "no_invoice");
  const taxIvaAmount = Number(formData.get("tax_iva_amount") ?? 0) || 0;

  if (!movementDate) throw new Error("La fecha es obligatoria");
  if (!movementTypeId) throw new Error("El tipo de movimiento es obligatorio");
  if (!paymentMethodId) throw new Error("La forma de pago es obligatoria");
  if (!amount || amount <= 0) throw new Error("El monto debe ser mayor a cero");
  if (taxIvaAmount < 0) throw new Error("El IVA no puede ser negativo");
  if (taxIvaAmount > amount) throw new Error("El IVA no puede ser mayor al monto total");

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
      tax_status: taxStatus,
      tax_iva_amount: taxIvaAmount,
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

export async function createMovementFromCfdi(formData: FormData) {
  const { supabase, businessId, userId } = await getContext();

  const movementDate = String(formData.get("movement_date") ?? "");
  const movementTypeId = String(formData.get("movement_type_id") ?? "");
  const paymentMethodId = String(formData.get("payment_method_id") ?? "");
  const supplierId = String(formData.get("supplier_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const amount = Number(formData.get("amount") ?? 0);
  const taxIvaAmount = Number(formData.get("tax_iva_amount") ?? 0) || 0;
  const cfdiUuid = String(formData.get("cfdi_uuid") ?? "").trim() || null;
  const cfdiIssuerRfc = String(formData.get("cfdi_issuer_rfc") ?? "").trim() || null;

  if (!movementDate) throw new Error("La fecha es obligatoria");
  if (!movementTypeId) throw new Error("El tipo de movimiento es obligatorio");
  if (!paymentMethodId) throw new Error("La forma de pago es obligatoria");
  if (!amount || amount <= 0) throw new Error("Selecciona al menos un concepto con importe mayor a cero");
  if (taxIvaAmount < 0 || taxIvaAmount > amount) throw new Error("El IVA calculado del XML no es válido");

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
      tax_status: "invoiced",
      tax_iva_amount: taxIvaAmount,
      cfdi_uuid: cfdiUuid,
      cfdi_issuer_rfc: cfdiIssuerRfc,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Esta factura (mismo folio fiscal) ya había sido registrada antes.");
    throw new Error(error.message);
  }
  revalidatePath("/compras-gastos");
  revalidatePath("/dashboard");
  return data.id as string;
}

export async function updateMovementTaxStatus(id: string, taxStatus: "no_invoice" | "pending_invoice" | "invoiced") {
  const { supabase, userId } = await getContext();
  const { error } = await supabase
    .from("financial_movements")
    .update({ tax_status: taxStatus, updated_by: userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/compras-gastos");
  revalidatePath("/dashboard");
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
