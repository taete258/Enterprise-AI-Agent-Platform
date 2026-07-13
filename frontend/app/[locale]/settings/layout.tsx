"use client";
import React from "react";
import AppShell from "@/components/AppShell";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Palette, User, Settings, Bell } from "lucide-react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("SettingsPage");

  const sidebarItems = [
    {
      id: "theme",
      label: t("submenuTheme"),
      href: "/settings/theme",
      icon: Palette,
      active: pathname === "/settings/theme" || pathname.startsWith("/settings/theme/"),
    },
    {
      id: "profile",
      label: t("submenuProfile"),
      href: "#",
      icon: User,
      disabled: true,
    },
    {
      id: "notifications",
      label: t("submenuNotifications"),
      href: "#",
      icon: Bell,
      disabled: true,
    },
  ];

  return (
    <AppShell>
      <div className="flex h-full min-w-0 overflow-hidden relative bg-background">
        {/* Settings Sub-Sidebar */}
        <aside className="w-64 border-r border-border bg-sidebar/35 flex flex-col shrink-0 min-w-0 h-full">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="font-serif text-[15px] font-semibold text-sidebar-foreground tracking-tight flex items-center gap-2">
              <Settings className="size-4 text-muted-foreground animate-spin-slow" />
              {t("settingsTitle")}
            </h2>
          </div>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-2 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              if (item.disabled) {
                return (
                  <div
                    key={item.id}
                    className="w-full text-left px-3 py-2.5 rounded-md flex items-center gap-2.5 text-muted-foreground/40 cursor-not-allowed select-none"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="text-[12.5px] font-medium">{item.label}</span>
                    <span className="text-[9px] bg-muted text-muted-foreground/60 px-1.5 py-0.5 rounded ml-auto font-medium">Soon</span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={item.href as any}
                  className={`w-full text-left px-3 py-2.5 rounded-md transition-all flex items-center gap-2.5 cursor-pointer ${
                    item.active
                      ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="text-[12.5px]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-background/50 h-full">
          {children}
        </div>
      </div>
    </AppShell>
  );
}
