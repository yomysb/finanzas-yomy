import { createClient } from "@/lib/supabase/server";
import CategoryManager from "./category-manager";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("expense_categories")
    .select("*")
    .order("name");

  return <CategoryManager categories={categories ?? []} />;
}
