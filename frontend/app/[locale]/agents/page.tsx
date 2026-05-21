"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { agents } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Bot, Trash2, Settings, MessageSquare } from "lucide-react";

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

  function handleDelete(agentId: number) {
    setList((prev) => prev.filter((a) => a.id !== agentId));
  }

  return (
    <AppShell>
      <Topbar
        title={t("title")}
        subtitle={list.length === 1 ? t("agentCount", { count: list.length }) : t("agentCountPlural", { count: list.length })}
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
            {filtered.map((a) => <AgentCard key={a.id} agent={a} onDelete={handleDelete} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AgentCard({ agent, onDelete }: { agent: any; onDelete: (id: number) => void }) {
  const t = useTranslations("AgentsPage");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await agents.delete(agent.id);
      onDelete(agent.id);
      setShowDeleteDialog(false);
    } catch (e) {
      console.error("Failed to delete agent:", e);
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Card className="p-5 hover:border-primary/40 hover:shadow-md transition-all h-full flex flex-col">
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
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] text-muted-foreground/80 font-mono">{t("temperature")} {agent.temperature.toFixed(2)} · {t("maxTokens")} {agent.max_tokens}</span>
            <div className="flex items-center gap-1">
            <Link href={`/agents/${agent.id}` as any} className="p-1 text-muted-foreground hover:text-foreground transition-colors hover:bg-accent rounded" title={t("manage")}>
              <Settings className="size-3.5" />
            </Link>
            <Link href={`/chat/${agent.id}` as any} className="p-1 text-muted-foreground hover:text-primary transition-colors hover:bg-accent rounded" title={t("open")}>
              <MessageSquare className="size-3.5" />
            </Link>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors hover:bg-destructive/10 rounded"
              title={t("delete")}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 font-mono">
            <span>
              {agent.input_cost_per_1k > 0 || agent.output_cost_per_1k > 0 ? (
                <>
                  in: ${agent.input_cost_per_1k.toFixed(4)}/1k · out: ${agent.output_cost_per_1k.toFixed(4)}/1k
                </>
              ) : (
                <span className="text-muted-foreground/50">No cost info</span>
              )}
            </span>
          </div>
        </div>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteAgentTitle")}</DialogTitle>
            <DialogDescription>{t("deleteAgentDesc", { name: agent.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
