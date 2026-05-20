"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function UsersPage() {
  const t = useTranslations("UsersPage");
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [err, setErr] = useState("");

  async function load() { setUsers(await admin.users()); }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await admin.createUser(form); setForm({ email: "", full_name: "", password: "" }); load(); }
    catch (e: any) { setErr(e.message); }
  }

  return (
    <section>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{t("email")}</Label>
                <Input type="email" required value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fullName")}</Label>
                <Input value={form.full_name}
                       onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("password")}</Label>
                <Input type="password" required value={form.password}
                       onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              {err && (
                <Alert variant="destructive" className="sm:col-span-3">
                  <AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <div className="sm:col-span-3"><Button>{t("addUser")}</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("id"), t("email"), t("fullName"), t("status")].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-accent/40">
                  <td className="px-3 py-2.5 text-muted-foreground">#{u.id}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback>{u.email[0].toUpperCase()}</AvatarFallback></Avatar>
                      <span className="font-medium">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{u.full_name || "—"}</td>
                  <td className="px-3 py-2.5 space-x-1">
                    {u.is_superuser && <Badge variant="default">Superuser</Badge>}
                    <Badge variant={u.is_active ? "success" : "muted"}>{u.is_active ? "active" : "inactive"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}
