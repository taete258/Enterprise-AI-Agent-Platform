"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
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
      router.push(redirectPath);
    } catch (e: any) { setErr(e.message || "Login failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center"><Logo /></div>
        <h1 className="font-serif text-3xl text-center text-foreground tracking-tight">
          Welcome back
        </h1>
        <p className="text-center text-[13px] text-muted-foreground mt-1">
          เข้าสู่ระบบเพื่อจัดการ AI Agent ของคุณ
        </p>

        <Card className="mt-7">
          <CardContent className="pt-5 space-y-3">
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required
                       value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" required
                       value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {err && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in…" : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-[10.5px] text-muted-foreground/70 mt-6 text-center">
          Default: <span className="font-mono">admin@example.com</span> · <span className="font-mono">admin123</span>
        </p>
      </div>
    </main>
  );
}
