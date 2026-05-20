"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

const ACTION_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  "agent.create": "success",
  "agent.update": "warning",
  "agent.delete": "destructive",
  "chat.send": "muted",
  "knowledge.upload": "success",
  "knowledge.bind": "default",
  "knowledge.deprecate": "destructive",
};

export default function AuditPage() {
  const t = useTranslations("AuditPage");
  const locale = useLocale();
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => { admin.audit(200).then(setRows).catch((e) => setErr(e.message)); }, []);

  return (
    <section>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        {err && <Card className="p-4 text-[13px] text-destructive border-destructive/40">{err}</Card>}
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("time"), "User", "Action", "Resource", "IP", "Detail"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border hover:bg-accent/40">
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground text-[10.5px] font-mono">{new Date(r.created_at).toLocaleString(locale === "th" ? "th-TH" : "en-US")}</td>
                  <td className="px-3 py-2.5">{r.user_id ?? "—"}</td>
                  <td className="px-3 py-2.5"><Badge variant={ACTION_VARIANT[r.action] || "muted"}>{r.action}</Badge></td>
                  <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground font-mono">{r.resource_type}:{r.resource_id}</td>
                  <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground font-mono">{r.ip || "—"}</td>
                  <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground font-mono max-w-md truncate" title={r.detail}>{r.detail}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">{t("noActivities")}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}
