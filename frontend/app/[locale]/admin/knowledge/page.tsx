"use client";
import { useEffect, useRef, useState } from "react";
import { knowledge, agents } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Upload, FileText, Link2, X, Table, FileType } from "lucide-react";

const STRUCTURED_EXTS = [".csv", ".tsv", ".xlsx", ".xls", ".json", ".jsonl", ".parquet"];
const UNSTRUCTURED_EXTS = [".pdf", ".txt", ".md", ".markdown", ".docx", ".doc", ".log", ".html", ".htm"];
const ACCEPT_EXTS = [...STRUCTURED_EXTS, ...UNSTRUCTURED_EXTS].join(",");

function classifyFile(name: string): "structured" | "unstructured" | "unknown" {
  const lower = (name || "").toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  if (STRUCTURED_EXTS.includes(ext)) return "structured";
  if (UNSTRUCTURED_EXTS.includes(ext)) return "unstructured";
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
import { useTranslations } from "next-intl";

export default function KnowledgePage() {
  const t = useTranslations("KnowledgePage");
  const [docs, setDocs] = useState<any[]>([]);
  const [ags, setAgs] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [desc, setDesc] = useState("");
  const [bindAgent, setBindAgent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() { setDocs(await knowledge.list()); setAgs(await agents.list()); }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setErr("");
    try {
      await knowledge.upload(file, desc);
      setFile(null); setDesc("");
      if (inputRef.current) inputRef.current.value = "";
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function doBind(docId: number) {
    if (!bindAgent) return;
    await knowledge.bind(Number(bindAgent), docId);
    alert(t("bindSuccess"));
  }

  async function deprecate(id: number) {
    if (!confirm(t("unbindConfirm"))) return;
    await knowledge.deprecate(id); load();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  }

  return (
    <section>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 pb-10 max-w-5xl mx-auto">

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={upload} className="space-y-4">
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                className={`block rounded-md border-2 border-dashed transition-colors cursor-pointer text-center py-10
                            ${drag ? "border-primary bg-accent" : "border-border bg-muted/40 hover:border-primary/40 hover:bg-accent/40"}`}>
                <input ref={inputRef} type="file" accept={ACCEPT_EXTS} className="hidden"
                       onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Upload className="size-7 mx-auto text-muted-foreground mb-2" />
                <div className="text-[13px] font-medium text-foreground flex items-center justify-center gap-2">
                  <span>{file ? file.name : t("dragPlaceholder")}</span>
                  {file && <TypeBadge kind={classifyFile(file.name)} />}
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-1">
                  Structured: CSV, TSV, XLSX, JSON · Unstructured: PDF, DOCX, TXT, MD
                </div>
              </label>

              <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>{t("descLabel")}</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("descPlaceholder")} />
                </div>
                <Button disabled={!file || busy}>
                  {busy ? t("processing") : t("uploadButton")}
                </Button>
              </div>
              {err && (
                <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription></Alert>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardContent className="pt-4 pb-4 flex items-center gap-3 flex-wrap">
            <span className="text-[13px] font-medium">{t("bindAgent")}</span>
            <Select value={bindAgent} onValueChange={setBindAgent}>
              <SelectTrigger className="w-56 h-8"><SelectValue placeholder={t("selectAgent")} /></SelectTrigger>
              <SelectContent>
                {ags.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[10.5px] text-muted-foreground">{t("bindInstructions")}</span>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4 pb-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-accent text-accent-foreground grid place-items-center shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    <span className="truncate">{d.name}</span>
                    <TypeBadge kind={(d.doc_type as any) || classifyFile(d.name)} />
                  </div>
                  <div className="text-[10.5px] text-muted-foreground font-mono truncate">
                    {d.description || t("noDescription")} · hash {d.content_hash.slice(0, 10)}…
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!bindAgent} onClick={() => doBind(d.id)}>
                    <Link2 className="size-3.5" /> {t("bind")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deprecate(d.id)}>
                    <X className="size-3.5" /> {t("unbind")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {docs.length === 0 && (
            <Card><CardContent className="pt-10 pb-10 text-center text-[13px] text-muted-foreground">{t("noDocs")}</CardContent></Card>
          )}
        </div>
      </div>
    </section>
  );
}
