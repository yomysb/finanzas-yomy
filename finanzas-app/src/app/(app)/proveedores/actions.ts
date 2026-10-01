"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSupplier(formData: FormData) {
  const supabase = await createClient();
  const { data: profile } = await supabase.auth.getUser();
  if (!profile.user) throw new Error("No autenticado");

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("business_id")
    .eq("id", profile.user.id)
    .single();
  if (!userProfile) throw new Error("Perfil de negocio no encontrado");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El nombre es obligatorio");

  const businessTypeId = formData.get("business_type_id");

  const { error } = await supabase.from("suppliers").insert({
    business_id: userProfile.business_id,
    name,
    legal_name: String(formData.get("legal_name") ?? "").trim() || null,
    tax_id: String(formData.get("tax_id") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    contact: String(formData.get("contact") ?? "").trim() || null,
    business_type_id: businessTypeId ? String(businessTypeId) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un proveedor con ese nombre.");
    throw new Error(error.message);
  }

  revalidatePath("/proveedores");
}

export async function updateSupplier(id: string, formData: FormData) {
  const supabase = await createClient();
  const businessTypeId = formData.get("business_type_id");

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      legal_name: String(formData.get("legal_name") ?? "").trim() || null,
      tax_id: String(formData.get("tax_id") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      contact: String(formData.get("contact") ?? "").trim() || null,
      business_type_id: businessTypeId ? String(businessTypeId) : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un proveedor con ese nombre.");
    throw new Error(error.message);
  }

  revalidatePath("/proveedores");
}

export async function toggleSupplierActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/proveedores");
}
