import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/signout-button";

const NAV = [
  { href: "/dashboard", label: "Panel" },
  { href: "/ventas", label: "Ventas" },
  { href: "/compras-gastos", label: "Compras y gastos" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/categorias", label: "Categorías" },
  { href: "/reportes", label: "Reportes" },
  { href: "/configuracion", label: "Configuración" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role, business:businesses(name)")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <aside className="flex flex-col border-line bg-paper-raised md:w-60 md:shrink-0 md:border-r">
        <div className="border-b border-line px-5 py-5">
          <p className="font-display text-lg italic text-ink">Finanzas</p>
          <p className="text-xs text-ink-soft">
            {(profile?.business as unknown as { name: string } | null)?.name ?? "Tu negocio"}
          </p>
        </div>
        <nav className="flex flex-1 flex-wrap gap-1 overflow-x-auto px-3 py-3 md:flex-col md:flex-nowrap md:overflow-visible">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-sm px-3 py-2 text-sm text-ink-soft hover:bg-paper hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-xs text-ink-soft">{profile?.full_name ?? user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
