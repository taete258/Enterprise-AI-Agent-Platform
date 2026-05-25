"use client";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import Logo from "./Logo";
import LocaleSwitcher from "./LocaleSwitcher";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const locale = useLocale();
  const t = useTranslations("Navigation");
  const [email, setEmail] = useState<string>("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const TABS = [
    { href: "/agents" as const, label: t("agents") },
    { href: "/admin/providers" as const, label: "Admin", startsWith: "/admin" },
  ];

  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!tok) return;
    try {
      const payload = JSON.parse(atob(tok.split(".")[1]));
      setEmail(payload.email || "");
    } catch {}
  }, []);

  function handleLogoutClick() {
    setShowLogoutConfirm(true);
  }

  function confirmLogout() {
    setShowLogoutConfirm(false);
    localStorage.removeItem("token");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-surface-ring">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/agents"><Logo /></Link>
        <nav className="hidden sm:flex items-center gap-1">
          {TABS.map((tab) => {
            const active = tab.startsWith ? pathname.startsWith(tab.startsWith) : pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors
                                ${active ? "bg-brand-100 text-brand-800" : "text-ink-700 hover:bg-brand-50 hover:text-brand-700"}`}>
                {tab.label}
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
          <LocaleSwitcher currentLocale={locale} />
          <button onClick={handleLogoutClick} className="btn-ghost !py-1.5 !px-3 text-xs">{t("logout")}</button>
        </div>
      </div>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmLogout")}</DialogTitle>
            <DialogDescription>
              {t("confirmLogoutMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLogout}
            >
              <LogOut className="size-4 mr-2" />
              {t("logout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
