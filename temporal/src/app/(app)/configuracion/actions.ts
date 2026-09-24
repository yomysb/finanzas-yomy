"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TABLES = ["payment_methods", "business_types"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

function assertTable(table: string): asserts table is AllowedTable {
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) throw new Error("Catálogo no válido");
}

export async function createSimpleItem(table: string, formData: FormData) {
  assertTable(table);
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

  const { error } = await supabase.from(table).insert({ business_id: userProfile.business_id, name });
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un elemento con ese nombre.");
    throw new Error(error.message);
  }
  revalidatePath("/configuracion");
}

export async function toggleSimpleItemActive(table: string, id: string, isActive: boolean) {
  assertTable(table);
  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/configuracion");
}
