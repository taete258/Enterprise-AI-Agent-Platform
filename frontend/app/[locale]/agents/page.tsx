"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { agents } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot } from "lucide-react";

export default function AgentsPage() {
  const t = useTranslations("AgentsPage");
  const [list, setList] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => { agents.list().then(setList).catch((e) => setErr(e.message)); }, []);

  const filtered = list.filter((a) =>
    !q || a.name.toLowerCase().includes(q.toLowerCase())
       || (a.description || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell>
      <Topbar
        title={t("title")}
        subtitle={`${list.length} agent${list.length === 1 ? "" : "s"}`}
        right={
          <>
            <Input className="w-64 h-8" placeholder={t("searchPlaceholder")}
                   value={q} onChange={(e) => setQ(e.target.value)} />
            <Button asChild size="sm"><Link href="/agents/new"><Plus className="size-4" /> {t("newAgent")}</Link></Button>
          </>
        }
      />

      <div className="px-6 py-7 max-w-6xl mx-auto">
        <header className="mb-7">
          <h1 className="font-serif text-3xl text-foreground tracking-tight">{t("title")}</h1>
          <p className="text-[13px] text-muted-foreground mt-1">{t("subtitle")}</p>
        </header>

        {err && (
          <Card className="border-destructive/40 bg-destructive/5 mb-4">
            <CardContent className="pt-4 text-[13px] text-destructive">{err}</CardContent>
          </Card>
        )}

        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => <AgentCard key={a.id} agent={a} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AgentCard({ agent }: { agent: any }) {
  const t = useTranslations("AgentsPage");
  return (
    <Link href={`/chat/${agent.id}` as any}>
      <Card className="p-5 hover:border-primary/40 hover:shadow-md transition-all group h-full">
        <div className="flex items-start justify-between mb-3.5">
          <div className="w-9 h-9 rounded-md bg-accent text-accent-foreground grid place-items-center font-serif text-[15px]">
            {agent.name[0]?.toUpperCase()}
          </div>
          <Badge variant={agent.is_published ? "success" : "muted"}>
            {agent.is_published ? t("published") : t("private")}
          </Badge>
        </div>
        <h2 className="font-serif text-[17px] text-foreground tracking-tight">{agent.name}</h2>
        <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2 min-h-[2.4rem]">
          {agent.description || t("noDescription")}
        </p>
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[10.5px] text-muted-foreground/80 font-mono">temp {agent.temperature.toFixed(2)} · max {agent.max_tokens}</span>
          <span className="text-[12px] font-medium text-primary group-hover:underline">{t("open")} →</span>
        </div>
      </Card>
    </Link>
  );
}

function EmptyState() {
  const t = useTranslations("AgentsPage");
  return (
    <Card className="p-14 text-center">
      <div className="w-12 h-12 mx-auto rounded-md bg-accent text-accent-foreground grid place-items-center">
        <Bot className="size-6" />
      </div>
      <h2 className="font-serif text-xl text-foreground mt-4">{t("noAgentsTitle")}</h2>
      <p className="text-[13px] text-muted-foreground mt-1">{t("noAgentsDesc")}</p>
      <Button asChild className="mt-5"><Link href="/agents/new"><Plus className="size-4" /> {t("createFirstAgent")}</Link></Button>
    </Card>
  );
}
