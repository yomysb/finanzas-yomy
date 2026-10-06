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
  return { supabase, businessId: profile.business_id as string };
}

function num(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function createMenuCategoryInline(name: string) {
  const { supabase, businessId } = await getContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre de la categoría es obligatorio");
  const { data, error } = await supabase
    .from("menu_categories")
    .insert({ business_id: businessId, name: trimmed })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe una categoría con ese nombre.");
    throw new Error(error.message);
  }
  revalidatePath("/menu");
  return data;
}

export async function toggleMenuCategoryActive(id: string, isActive: boolean) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("menu_categories").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
}

export async function createMenuProduct(formData: FormData) {
  const { supabase, businessId } = await getContext();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El nombre del producto es obligatorio");

  const categoryId = String(formData.get("category_id") ?? "") || null;
  const productionCost = num(formData, "production_cost");
  const salePrice = num(formData, "sale_price");
  const tpvCommissionPct = num(formData, "tpv_commission_pct");
  const targetMarginPct = num(formData, "target_margin_pct");

  if (productionCost < 0 || salePrice < 0) throw new Error("Costo y precio no pueden ser negativos");
  if (targetMarginPct >= 100) throw new Error("El margen objetivo debe ser menor a 100%");

  const { error } = await supabase.from("menu_products").insert({
    business_id: businessId,
    name,
    category_id: categoryId,
    production_cost: productionCost,
    sale_price: salePrice,
    tpv_commission_pct: tpvCommissionPct,
    target_margin_pct: targetMarginPct,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un producto con ese nombre.");
    throw new Error(error.message);
  }

  revalidatePath("/menu");
}

export async function updateMenuProduct(id: string, formData: FormData) {
  const { supabase } = await getContext();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El nombre del producto es obligatorio");

  const categoryId = String(formData.get("category_id") ?? "") || null;
  const productionCost = num(formData, "production_cost");
  const salePrice = num(formData, "sale_price");
  const tpvCommissionPct = num(formData, "tpv_commission_pct");
  const targetMarginPct = num(formData, "target_margin_pct");

  if (productionCost < 0 || salePrice < 0) throw new Error("Costo y precio no pueden ser negativos");
  if (targetMarginPct >= 100) throw new Error("El margen objetivo debe ser menor a 100%");

  const { error } = await supabase
    .from("menu_products")
    .update({
      name,
      category_id: categoryId,
      production_cost: productionCost,
      sale_price: salePrice,
      tpv_commission_pct: tpvCommissionPct,
      target_margin_pct: targetMarginPct,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un producto con ese nombre.");
    throw new Error(error.message);
  }

  revalidatePath("/menu");
}

export async function toggleMenuProductActive(id: string, isActive: boolean) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("menu_products").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/menu");
}
