"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="mt-1 text-xs font-medium text-ink-soft underline decoration-line underline-offset-2 hover:text-rust"
    >
      Cerrar sesión
    </button>
  );
}
