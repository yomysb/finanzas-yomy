"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/signout-button";

type NavItem = { href: string; label: string };

export default function MobileNav({
  nav,
  businessName,
  userLabel,
}: {
  nav: NavItem[];
  businessName: string;
  userLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="border-b border-line bg-paper-raised md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="font-display font-semibold tracking-tight text-lg text-ink">Finanzas</p>
          <p className="text-xs text-ink-soft">{businessName}</p>
        </div>
        <button
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg border border-line"
        >
          <span
            className={`block h-0.5 w-5 bg-ink transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span className={`block h-0.5 w-5 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
          <span
            className={`block h-0.5 w-5 bg-ink transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {open && (
        <nav className="border-t border-line px-2 py-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm ${
                pathname === item.href ? "bg-paper text-ink" : "text-ink-soft hover:bg-paper hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-line px-3 py-3">
            <p className="truncate text-xs text-ink-soft">{userLabel}</p>
            <SignOutButton />
          </div>
        </nav>
      )}
    </div>
  );
}
