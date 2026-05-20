"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { ShieldAlert, ArrowRight, Home } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

export default function UnauthorizedPage() {
  const t = useTranslations("UnauthorizedPage");
  const [fromPath, setFromPath] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setFromPath(params.get("from") || "/agents");
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-accent/15">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center mb-2">
          <Logo />
        </div>

        <Card className="border-border/60 shadow-xl backdrop-blur-sm bg-card/90 overflow-hidden relative">
          {/* Subtle top indicator bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-destructive animate-pulse" />

          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive animate-pulse">
              <ShieldAlert className="size-8" strokeWidth={2} />
            </div>
            <CardTitle className="font-serif text-2xl text-foreground tracking-tight">
              {t("title")}
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2 text-[13px]">
              {t("subtitle")}
            </CardDescription>
          </CardHeader>

          <CardContent className="text-center space-y-4 px-6">
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              {t("description")}
            </p>
            {fromPath && (
              <div className="inline-block px-3 py-1 rounded bg-muted/60 text-muted-foreground text-[11px] font-mono select-none">
                {t("requestedPath", { path: fromPath })}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 px-6 pb-8 pt-4">
            <Button
              asChild
              className="w-full h-11 text-[14px] font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 cursor-pointer"
            >
              <Link href={`/?from=${encodeURIComponent(fromPath)}` as any}>
                {t("signIn")}
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full h-11 text-[14px] font-medium cursor-pointer"
            >
              <Link href="/">
                <Home className="size-4 mr-2" />
                {t("backHome")}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
