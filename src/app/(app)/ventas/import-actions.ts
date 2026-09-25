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

export async function getExistingSaleDates(): Promise<string[]> {
  const { supabase } = await getContext();
  const { data } = await supabase.from("sales").select("sale_date").is("voided_at", null);
  return (data ?? []).map((d) => d.sale_date as string);
}

export type ImportSaleRow = {
  sale_date: string;
  num_orders: number;
  num_products: number;
  cash_amount: number;
  card_amount: number;
  transfer_amount: number;
  notes?: string | null;
};

export async function importSales(rows: ImportSaleRow[]) {
  const { supabase, businessId, userId } = await getContext();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("sales")
      .select("id")
      .eq("sale_date", row.sale_date)
      .maybeSingle();

    const payload = {
      business_id: businessId,
      sale_date: row.sale_date,
      num_orders: row.num_orders,
      num_products: row.num_products,
      cash_amount: row.cash_amount,
      card_amount: row.card_amount,
      transfer_amount: row.transfer_amount,
      notes: row.notes ?? null,
      updated_by: userId,
    };

    if (existing) {
      const { error } = await supabase.from("sales").update(payload).eq("id", existing.id);
      if (error) errors.push(`${row.sale_date}: ${error.message}`);
      else updated++;
    } else {
      const { error } = await supabase.from("sales").insert({ ...payload, created_by: userId });
      if (error) errors.push(`${row.sale_date}: ${error.message}`);
      else created++;
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  return { created, updated, errors };
}
