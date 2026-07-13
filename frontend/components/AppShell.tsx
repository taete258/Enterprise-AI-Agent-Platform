"use client";
import { usePathname, useRouter, Link } from "@/i18n/routing";
import { useEffect, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bot, MessagesSquare, BookOpen, Cpu, Plug, Users, BarChart3, ScrollText, LogOut, Wrench, Shield, Settings,
} from "lucide-react";
import { Logo, ThemeToggle, Avatar, AvatarFallback, Separator } from "@taete258/ds";
import LocaleSwitcher from "./LocaleSwitcher";
import { isTokenValid, auth } from "@/lib/api";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
  permission?: string;
}

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
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  const can = useCallback((permission: string) => {
    if (isSuperuser) return true;
    return permissions.includes(permission);
  }, [isSuperuser, permissions]);

  const isAdmin = isSuperuser || permissions.includes("user:admin");

  const ALL_NAV: NavGroup[] = [
    {
      section: t("workspace"),
      items: [
        { href: "/agents",  label: t("agents"), icon: Bot,            permission: "agent:view" },
        { href: "/chat",    label: t("chats"),  icon: MessagesSquare },
      ],
    },
    {
      section: t("library"),
      items: [
        { href: "/admin/knowledge", label: t("knowledge"), icon: BookOpen, permission: "knowledge:view" },
        { href: "/admin/models",    label: t("models"),    icon: Cpu,      permission: "llm:view" },
        { href: "/admin/tools",     label: t("tools"),     icon: Wrench,   permission: "tool:view" },
      ],
    },
    {
      section: t("manage"),
      permission: "user:admin",
      items: [
        { href: "/admin/providers", label: t("providers"), icon: Plug },
        { href: "/admin/users",     label: t("users"),     icon: Users },
        { href: "/admin/roles",     label: t("roles"),     icon: Shield },
        { href: "/admin/dashboard", label: t("usage"),     icon: BarChart3 },
        { href: "/admin/audit",     label: t("auditLog"),  icon: ScrollText },
      ],
    },
    {
      section: t("settings") || "Settings",
      items: [
        { href: "/settings/theme", label: t("generalSetting") || "General Setting", icon: Settings },
      ],
    },
  ];

  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!isTokenValid(tok)) {
      router.push(`/unauthorized?from=${encodeURIComponent(pathname)}` as any);
      return;
    }
    try {
      const payload = JSON.parse(atob(tok!.split(".")[1]));
      setEmail(payload.email || "");
      const su = !!payload.su;
      setIsSuperuser(su);
      if (!su) {
        // Fetch permissions for non-superusers
        auth.myPermissions()
          .then((data) => setPermissions(data.permissions))
          .catch(() => {})
          .finally(() => setCheckingAuth(false));
      } else {
        setCheckingAuth(false);
      }
    } catch {
      router.push(`/unauthorized?from=${encodeURIComponent(pathname)}` as any);
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
          {ALL_NAV.map((group) => {
            // Hide entire section if it requires a permission the user doesn't have
            if (group.permission && !can(group.permission)) return null;

            const visibleItems = group.items.filter((it) =>
              !it.permission || can(it.permission)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.section}>
                <div className="px-3 mb-1 section-h">{group.section}</div>
                <div className="space-y-0.5">
                  {visibleItems.map((it) => {
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
            );
          })}
        </nav>
        <Separator className="bg-sidebar-border" />
        <div className="p-2.5 space-y-2">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex-1 min-w-0">
              <LocaleSwitcher currentLocale={locale} />
            </div>
            <ThemeToggle />
          </div>
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
