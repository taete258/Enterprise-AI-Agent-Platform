"use client";
import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useTheme, Button, Badge } from "@taete258/ds";
import { Sun, Moon, Laptop, Check, HelpCircle } from "lucide-react";

export default function ThemeSettingsPage() {
  const t = useTranslations("SettingsPage");
  const { theme: currentMode, setTheme: setMode } = useTheme();
  const [themeColor, setThemeColor] = useState<string>("forest");

  useEffect(() => {
    const saved = localStorage.getItem("theme-color") || "forest";
    setThemeColor(saved);
  }, []);

  const handleColorChange = (color: string) => {
    setThemeColor(color);
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove(
        "theme-forest",
        "theme-ocean",
        "theme-terracotta",
        "theme-slate",
        "theme-purple"
      );
      document.documentElement.classList.add(`theme-${color}`);
      localStorage.setItem("theme-color", color);
    }
  };

  const themesList = [
    {
      id: "forest",
      name: t("themeForest"),
      primaryBg: "bg-[#1c5630]",
      accentBg: "bg-[#e2f0e6]",
      cardBg: "bg-[#f8f9f5]",
      darkPrimaryBg: "bg-[#54d482]",
      darkAccentBg: "bg-[#14291a]",
    },
    {
      id: "ocean",
      name: t("themeOcean"),
      primaryBg: "bg-[#104d80]",
      accentBg: "bg-[#e6f1fc]",
      cardBg: "bg-[#f4f7fa]",
      darkPrimaryBg: "bg-[#4da3ff]",
      darkAccentBg: "bg-[#0b1b2d]",
    },
    {
      id: "terracotta",
      name: t("themeTerracotta"),
      primaryBg: "bg-[#bf5b28]",
      accentBg: "bg-[#fdf0e9]",
      cardBg: "bg-[#faf7f3]",
      darkPrimaryBg: "bg-[#ff8f59]",
      darkAccentBg: "bg-[#29170e]",
    },
    {
      id: "slate",
      name: t("themeSlate"),
      primaryBg: "bg-[#3b4b5e]",
      accentBg: "bg-[#f0f3f6]",
      cardBg: "bg-[#f6f8fa]",
      darkPrimaryBg: "bg-[#9db2c9]",
      darkAccentBg: "bg-[#1b222b]",
    },
    {
      id: "purple",
      name: t("themePurple"),
      primaryBg: "bg-[#6a35a6]",
      accentBg: "bg-[#f5eefc]",
      cardBg: "bg-[#f9f5fd]",
      darkPrimaryBg: "bg-[#b98aff]",
      darkAccentBg: "bg-[#201035]",
    },
  ];

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold tracking-tight text-foreground">{t("themePageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("themePageSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Selection Area */}
        <div className="lg:col-span-3 space-y-8">
          {/* Mode Selection */}
          <div className="space-y-3">
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">{t("modeSection")}</h3>
              <p className="text-xs text-muted-foreground">{t("modeDesc")}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "light", label: t("modeLight"), icon: Sun },
                { id: "dark", label: t("modeDark"), icon: Moon },
                { id: "system", label: t("modeSystem"), icon: Laptop },
              ].map((m) => {
                const Icon = m.icon;
                const active = currentMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id as any)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      active
                        ? "border-primary bg-accent/40 text-foreground shadow-sm scale-[1.02]"
                        : "border-border hover:border-muted-foreground/35 bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-5 mb-2" strokeWidth={2} />
                    <span className="text-xs font-semibold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">{t("colorThemeSection")}</h3>
              <p className="text-xs text-muted-foreground">{t("colorThemeDesc")}</p>
            </div>
            <div className="space-y-2.5">
              {themesList.map((thm) => {
                const active = themeColor === thm.id;
                return (
                  <button
                    key={thm.id}
                    onClick={() => handleColorChange(thm.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      active
                        ? "border-primary bg-accent/40 shadow-sm scale-[1.01]"
                        : "border-border hover:border-muted-foreground/35 bg-card hover:bg-accent/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1.5">
                        <span className={`w-5 h-5 rounded-full border border-border/40 ${thm.primaryBg}`} />
                        <span className={`w-5 h-5 rounded-full border border-border/40 ${thm.accentBg}`} />
                        <span className={`w-5 h-5 rounded-full border border-border/40 ${thm.cardBg}`} />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{thm.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="hidden sm:flex items-center gap-1">
                        <span className={`w-3.5 h-3.5 rounded-full border border-border/20 ${thm.darkPrimaryBg}`} />
                        <span className={`w-3.5 h-3.5 rounded-full border border-border/20 ${thm.darkAccentBg}`} />
                      </div>
                      {active && (
                        <div className="bg-primary text-primary-foreground p-0.5 rounded-full">
                          <Check className="size-3.5" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="lg:col-span-2 space-y-3">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">{t("previewTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("previewDesc")}</p>
          </div>
          <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-md flex flex-col h-[400px]">
            {/* Mockup Header */}
            <div className="h-10 border-b border-border bg-sidebar/50 px-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-secondary/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
              </div>
              <div className="w-28 h-4 rounded bg-muted/60" />
              <div className="size-4 rounded-full bg-muted/60" />
            </div>

            {/* Mockup Body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Mockup Sidebar */}
              <div className="w-14 border-r border-border bg-sidebar/35 p-2 flex flex-col items-center gap-3">
                <div className="size-6 rounded bg-primary/20 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-primary">AG</span>
                </div>
                <div className="w-8 h-3 rounded bg-accent" />
                <div className="w-8 h-3 rounded bg-muted" />
                <div className="w-8 h-3 rounded bg-muted" />
              </div>

              {/* Mockup Dashboard Content */}
              <div className="flex-1 p-3.5 flex flex-col justify-between overflow-y-auto space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("previewLabel")}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0.25">
                      {t("previewBadge")}
                    </Badge>
                  </div>

                  {/* Outgoing bubble */}
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground text-[10.5px] px-3 py-2 rounded-xl rounded-tr-none max-w-[85%] shadow-sm">
                      How does this theme look in real-time?
                    </div>
                  </div>

                  {/* Incoming bubble */}
                  <div className="flex justify-start">
                    <div className="bg-accent text-accent-foreground text-[10.5px] px-3 py-2 rounded-xl rounded-tl-none max-w-[85%] shadow-sm border border-border/20">
                      It updates dynamically on click! It feels premium.
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between font-sans">
                  <span className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                    <HelpCircle className="size-3 text-muted-foreground/60" />
                    Help resources
                  </span>
                  <Button size="sm" className="text-[10.5px] h-7 px-3">
                    {t("previewButton")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
