"use client";
import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { auth } from "@/lib/api";
import Logo from "@/components/Logo";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("LoginPage");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/agents");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const from = params.get("from");
      if (from && from !== "/unauthorized") {
        setRedirectPath(from);
      }
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const { access_token } = await auth.login(email, password);
      localStorage.setItem("token", access_token);
      router.push(redirectPath as any);
    } catch (e: any) { setErr(e.message || "Login failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-stretch">
      {/* Left Side - Illustration */}
      <div className="hidden lg:flex lg:w-[65%] bg-gradient-to-br from-primary via-primary to-accent flex-col justify-between p-16 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full -ml-40 -mb-40"></div>

        <div className="relative z-10">
          <div className="ml-10 mb-12 inline-flex scale-150 rounded-3xl bg-white/45 backdrop-blur p-4 shadow-xl box-sizing-border-box">
            <Logo />
          </div>
          <h1 className="text-6xl font-bold text-white mt-12 mb-6 leading-tight">
            {t("heroTitle")}
          </h1>
          <p className="text-white/85 text-xl max-w-lg leading-relaxed font-light">
            {t("heroSubtitle")}
          </p>
        </div>

        {/* Bottom Section */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 shadow-lg">
              <ArrowRight className="text-white" size={28} />
            </div>
            <div>
              <p className="font-semibold text-white text-lg mb-2">{t("feature1Title")}</p>
              <p className="text-white/75 text-base leading-relaxed">{t("feature1Desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 shadow-lg">
              <ArrowRight className="text-white" size={28} />
            </div>
            <div>
              <p className="font-semibold text-white text-lg mb-2">{t("feature2Title")}</p>
              <p className="text-white/75 text-base leading-relaxed">{t("feature2Desc")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-[35%] flex flex-col justify-center px-6 sm:px-8 lg:px-10 py-12">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <div className="rounded-2xl p-3 bg-primary/10">
              <Logo />
            </div>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              {t("title")}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              {t("subtitle")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                {t("email")}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg border-border bg-card px-4 text-base placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                {t("password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border-border bg-card px-4 pr-11 text-base placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {err && (
              <Alert variant="destructive" className="mt-4 rounded-lg">
                <AlertCircle className="size-4" />
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("signingIn") : t("continue")}
            </Button>
          </form>


          {/* Language Switcher */}
          <div className="mt-6 flex justify-center">
            <LocaleSwitcher currentLocale={locale} />
          </div>
        </div>
      </div>
    </main>
  );
}
