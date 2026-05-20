"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Logo from "./Logo";

const TABS = [
  { href: "/agents", label: "Agents" },
  { href: "/admin/providers", label: "Admin", startsWith: "/admin" },
];

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!t) return;
    try {
      const payload = JSON.parse(atob(t.split(".")[1]));
      setEmail(payload.email || "");
    } catch {}
  }, []);

  function logout() {
    localStorage.removeItem("token");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-surface-ring">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/agents"><Logo /></Link>
        <nav className="hidden sm:flex items-center gap-1">
          {TABS.map((t) => {
            const active = t.startsWith ? pathname.startsWith(t.startsWith) : pathname === t.href;
            return (
              <Link key={t.href} href={t.href}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors
                                ${active ? "bg-brand-100 text-brand-800" : "text-ink-700 hover:bg-brand-50 hover:text-brand-700"}`}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {email && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-semibold">
                {email[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-ink-700">{email}</span>
            </div>
          )}
          <button onClick={logout} className="btn-ghost !py-1.5 !px-3 text-xs">ออกจากระบบ</button>
        </div>
      </div>
    </header>
  );
}
