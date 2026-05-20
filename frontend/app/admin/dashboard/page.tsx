"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => { admin.costs(days).then(setData).catch((e) => setErr(e.message)); }, [days]);

  const fmt = (n: number) => n.toLocaleString();
  const $ = (n: number) => `$${n.toFixed(4)}`;

  return (
    <section>
      <PageHeader title="Usage" subtitle="ภาพรวมการใช้งานและค่าใช้จ่ายโทเค็น"
        action={
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[7, 30, 90, 365].map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
            </SelectContent>
          </Select>
        } />
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        {err && <Card className="border-destructive/40"><CardContent className="pt-4 text-[13px] text-destructive">{err}</CardContent></Card>}
        {!data && !err && <Card><CardContent className="pt-6 text-center text-[13px] text-muted-foreground">Loading…</CardContent></Card>}

        {data && (
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <Stat label="Tokens in"  value={fmt(data.total.tokens_in)} />
              <Stat label="Tokens out" value={fmt(data.total.tokens_out)} />
              <Stat label="Cost (USD)" value={$(data.total.cost_usd)} highlight />
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <Breakdown title="By user" rows={data.by_user} />
              <Breakdown title="By agent" rows={data.by_agent} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="pt-5">
        <div className="section-h">{label}</div>
        <div className={`font-serif text-3xl tracking-tight mt-2 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Breakdown({ title, rows }: { title: string; rows: any[] }) {
  const max = Math.max(1, ...rows.map((r) => r.cost_usd));
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="section-h mb-4">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-3">ไม่มีข้อมูล</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-foreground truncate">{r.label}</span>
                  <span className="text-muted-foreground tabular-nums font-mono text-[12px]">${r.cost_usd.toFixed(4)}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(r.cost_usd / max) * 100}%` }} />
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-1 font-mono">
                  ↑ {r.tokens_in.toLocaleString()} · ↓ {r.tokens_out.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
