"use client";
import { usePathname, useRouter, Link } from "@/i18n/routing";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bot, MessagesSquare, BookOpen, Cpu, Plug, Users, BarChart3, ScrollText, LogOut, Wrench,
} from "lucide-react";
import Logo from "./Logo";
import LocaleSwitcher from "./LocaleSwitcher";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";
import { isTokenValid } from "@/lib/api";

export default function AppShell({ children, rightPanel }: {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Navigation");
  const [email, setEmail] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const NAV = [
    {
      section: t("workspace"),
      items: [
        { href: "/agents", label: t("agents"), icon: Bot },
        { href: "/chat",   label: t("chats"),  icon: MessagesSquare },
      ],
    },
    {
      section: t("library"),
      items: [
        { href: "/admin/knowledge", label: t("knowledge"), icon: BookOpen },
        { href: "/admin/models",    label: t("models"),    icon: Cpu },
        { href: "/admin/tools",     label: t("tools"),     icon: Wrench },
      ],
    },
    {
      section: t("manage"),
      items: [
        { href: "/admin/providers", label: t("providers"), icon: Plug },
        { href: "/admin/users",     label: t("users"),     icon: Users },
        { href: "/admin/dashboard", label: t("usage"),     icon: BarChart3 },
        { href: "/admin/audit",     label: t("auditLog"),  icon: ScrollText },
      ],
    },
  ];

  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!isTokenValid(tok)) {
      router.push(`/unauthorized?from=${encodeURIComponent(pathname)}` as any);
    } else {
      try {
        const payload = JSON.parse(atob(tok!.split(".")[1]));
        setEmail(payload.email || "");
        setCheckingAuth(false);
      } catch {
        router.push(`/unauthorized?from=${encodeURIComponent(pathname)}` as any);
      }
    }
  }, [pathname, router]);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("chatSidebarZoneHeights");
    localStorage.removeItem("chatPanelStates");
    localStorage.removeItem("lastActiveSession");
    router.push("/");
  }

  if (checkingAuth) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[13px] text-muted-foreground font-medium animate-pulse">{t("checkingAuth")}</p>
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
                    <Link key={it.href} href={it.href as any} className={`nav-item ${active ? "active" : ""}`}>
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
        <div className="p-2.5 space-y-2">
          <LocaleSwitcher currentLocale={locale} />
          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar><AvatarFallback className="bg-primary text-primary-foreground">{(email[0] || "?").toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-foreground truncate">{email || "guest"}</div>
              <button onClick={logout}
                      className="text-[10.5px] text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                <LogOut className="size-3" /> {t("logout")}
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
