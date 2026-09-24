"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCategory(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("No autenticado");

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("business_id")
    .eq("id", auth.user.id)
    .single();
  if (!userProfile) throw new Error("Perfil de negocio no encontrado");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El nombre es obligatorio");
  const parentId = formData.get("parent_category_id");

  const { error } = await supabase.from("expense_categories").insert({
    business_id: userProfile.business_id,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    parent_category_id: parentId ? String(parentId) : null,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe esa categoría (con ese mismo padre).");
    throw new Error(error.message);
  }
  revalidatePath("/categorias");
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/categorias");
}
