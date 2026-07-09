"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { agents, knowledge } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Topbar, Button, Card, CardContent, Alert, AlertDescription, Badge, Label } from "@taete258/ds";
import { Link } from "@/i18n/routing";
import { AlertCircle, FileText, MessageSquare, Settings, BookOpen, Table, FileType, Edit } from "lucide-react";

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 px-4 py-2.5 text-[13px] bg-card">
      <div className="text-muted-foreground">{k}</div>
      <div className="col-span-2 text-foreground">{v}</div>
    </div>
  );
}

function classifyFile(name: string): "structured" | "unstructured" | "unknown" {
  const STRUCTURED = [".csv", ".tsv", ".xlsx", ".xls", ".json", ".jsonl", ".parquet"];
  const UNSTRUCTURED = [".pdf", ".txt", ".md", ".markdown", ".docx", ".doc", ".log", ".html", ".htm"];
  const ext = (name || "").toLowerCase().slice((name || "").toLowerCase().lastIndexOf("."));
  if (STRUCTURED.includes(ext)) return "structured";
  if (UNSTRUCTURED.includes(ext)) return "unstructured";
  return "unknown";
}

function TypeBadge({ kind }: { kind: "structured" | "unstructured" | "unknown" }) {
  const map = {
    structured: { label: "Structured", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: Table },
    unstructured: { label: "Unstructured", cls: "bg-sky-100 text-sky-700 border-sky-200", Icon: FileType },
    unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground border-border", Icon: FileText },
  } as const;
  const { label, cls, Icon } = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>
      <Icon className="size-3" /> {label}
    </span>
  );
}

export default function AgentManagePage() {
  const t = useTranslations("AgentManagePage");
  const params = useParams();
  const agentId = Number(params.agentId);

  const [agent, setAgent] = useState<any>(null);
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [boundIds, setBoundIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    const [ag, allKnowledge, boundKnowledge] = await Promise.all([
      agents.get(agentId),
      knowledge.list(),
      agents.listKnowledge(agentId),
    ]);
    setAgent(ag);
    setAllDocs(allKnowledge);
    setBoundIds(new Set(boundKnowledge.map((d: any) => d.id)));
  }

  useEffect(() => { load().catch((e) => setErr(e.message)); }, [agentId]);

  function toggle(docId: number) {
    setBoundIds((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  }

  async function save() {
    setSaving(true); setErr(""); setSaved(false);
    try {
      const currentBound = await agents.listKnowledge(agentId);
      const currentIds = new Set(currentBound.map((d: any) => d.id));

      const toAdd = [...boundIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !boundIds.has(id));

      await Promise.all([
        ...toAdd.map((docId) => knowledge.bind(agentId, docId)),
        ...toRemove.map((docId) => knowledge.unbind(agentId, docId)),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!agent) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-[13px]">
          {err || "Loading…"}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Topbar title={agent.name} subtitle={t("subtitle")} />

      <div className="px-6 py-7 max-w-3xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-accent text-accent-foreground grid place-items-center font-serif text-[16px] shrink-0">
              {agent.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="font-serif text-2xl text-foreground tracking-tight flex items-center gap-2">
                {agent.name}
                <Badge variant={agent.is_published ? "success" : "muted"} className="text-[10px]">
                  {agent.is_published ? "published" : "private"}
                </Badge>
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">{agent.description || t("noDescription")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/agents/${agentId}/edit` as any}>
                <Edit className="size-4" /> {t("edit")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/chat/${agentId}` as any}>
                <MessageSquare className="size-4" /> {t("openChat")}
              </Link>
            </Button>
          </div>
        </header>

        <Card className="mb-6">
          <CardContent className="pt-5">
            <Label className="mb-3 block text-[12px] font-semibold">{t("agentDetails")}</Label>
            <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
              <DetailRow k="Name" v={agent.name} />
              <DetailRow k="Description" v={agent.description || "—"} />
              <DetailRow k="System Prompt" v={agent.system_prompt?.substring(0, 80) + (agent.system_prompt?.length > 80 ? "…" : "") || "—"} />
              <DetailRow k="Model" v={agent.model_id?.toString() || "—"} />
              <DetailRow k="Temperature" v={agent.temperature?.toFixed(2) || "—"} />
              <DetailRow k="Max Tokens" v={agent.max_tokens?.toString() || "—"} />
              <DetailRow k="Visibility" v={agent.is_published ? "Published" : "Private"} />
            </div>
          </CardContent>
        </Card>

        {err && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-muted-foreground" />
                <h2 className="text-[14px] font-semibold">{t("knowledgeTitle")}</h2>
                <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {boundIds.size} / {allDocs.length}
                </span>
              </div>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? t("saving") : saved ? t("saved") : t("saveChanges")}
              </Button>
            </div>

            <p className="text-[12px] text-muted-foreground mb-4">{t("knowledgeDesc")}</p>

            {allDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-[13px]">
                {t("noDocs")}{" "}
                <Link href="/admin/knowledge" className="text-primary underline underline-offset-2">
                  {t("uploadLink")}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {allDocs.map((doc) => {
                  const checked = boundIds.has(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors
                        ${checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent/40"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(doc.id)}
                        className="w-4 h-4 accent-primary shrink-0"
                      />
                      <div className="w-8 h-8 rounded bg-accent text-accent-foreground grid place-items-center shrink-0">
                        <FileText className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium flex items-center gap-2 truncate">
                          <span className="truncate">{doc.name}</span>
                          <TypeBadge kind={(doc.doc_type as any) || classifyFile(doc.name)} />
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {doc.description || t("noDocDescription")}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
