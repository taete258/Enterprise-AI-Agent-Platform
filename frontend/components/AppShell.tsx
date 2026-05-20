"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot, MessagesSquare, BookOpen, Cpu, Plug, Users, BarChart3, ScrollText, LogOut,
} from "lucide-react";
import Logo from "./Logo";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";
import { isTokenValid } from "@/lib/api";

const NAV = [
  {
    section: "Workspace",
    items: [
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/chat",   label: "Chats",  icon: MessagesSquare },
    ],
  },
  {
    section: "Library",
    items: [
      { href: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
      { href: "/admin/models",    label: "Models",    icon: Cpu },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/admin/providers", label: "Providers", icon: Plug },
      { href: "/admin/users",     label: "Users",     icon: Users },
      { href: "/admin/dashboard", label: "Usage",     icon: BarChart3 },
      { href: "/admin/audit",     label: "Audit log", icon: ScrollText },
    ],
  },
];

export default function AppShell({ children, rightPanel }: {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!isTokenValid(t)) {
      router.push(`/unauthorized?from=${encodeURIComponent(pathname)}`);
    } else {
      try {
        const payload = JSON.parse(atob(t!.split(".")[1]));
        setEmail(payload.email || "");
        setCheckingAuth(false);
      } catch {
        router.push(`/unauthorized?from=${encodeURIComponent(pathname)}`);
      }
    }
  }, [pathname, router]);

  function logout() { localStorage.removeItem("token"); router.push("/"); }

  if (checkingAuth) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[13px] text-muted-foreground font-medium animate-pulse">กำลังตรวจสอบสิทธิ์…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen grid"
         style={{ gridTemplateColumns: `224px 1fr ${rightPanel ? "320px" : "0"}` }}>
      <aside className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col min-w-0">
        <div className="h-12 px-3 flex items-center border-b border-sidebar-border">
          <Link href="/agents"><Logo /></Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="px-3 mb-1 section-h">{group.section}</div>
              <div className="space-y-0.5">
                {group.items.map((it) => {
                  const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
                  const Icon = it.icon;
                  return (
                    <Link key={it.href} href={it.href} className={`nav-item ${active ? "active" : ""}`}>
                      <Icon className="size-4" strokeWidth={1.8} />
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <Separator className="bg-sidebar-border" />
        <div className="p-2.5">
          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar><AvatarFallback className="bg-primary text-primary-foreground">{(email[0] || "?").toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-foreground truncate">{email || "guest"}</div>
              <button onClick={logout}
                      className="text-[10.5px] text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                <LogOut className="size-3" /> ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 overflow-y-auto">{children}</main>

      {rightPanel && (
        <aside className="bg-sidebar border-l border-sidebar-border overflow-y-auto">{rightPanel}</aside>
      )}
    </div>
  );
}
