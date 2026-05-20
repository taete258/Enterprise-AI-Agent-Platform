"use client";
import { useEffect, useRef, useState } from "react";
import { knowledge } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import GraphVisualizer from "@/components/GraphVisualizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Upload, FileText, X, Table, FileType, Trash2 } from "lucide-react";

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
  const [file, setFile] = useState<File | null>(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"docs" | "graph">("docs");
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [loadingGraph, setLoadingGraph] = useState(false);

  async function loadGraph() {
    setLoadingGraph(true);
    try {
      const data = await knowledge.graph();
      setGraphData(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoadingGraph(false);
    }
  }

  useEffect(() => {
    if (tab === "graph") {
      loadGraph();
    }
  }, [tab]);

  async function load() { setDocs(await knowledge.list()); }
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

  async function deprecate(id: number) {
    setDocToDelete(id);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (docToDelete === null) return;
    setDeleteDialogOpen(false);
    await knowledge.deprecate(docToDelete);
    setDocToDelete(null);
    load();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  }

  return (
    <section>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        <div className="flex gap-2 mb-6 border-b border-border pb-px">
          <button 
            type="button"
            onClick={() => setTab("docs")} 
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "docs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t("documentsTab")}
          </button>
          <button 
            type="button"
            onClick={() => setTab("graph")} 
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "graph" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t("graphTab")}
          </button>
        </div>

        {tab === "docs" ? (
          <>
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

        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedDoc(d)}>
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
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deprecate(d.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {docs.length === 0 && (
            <Card><CardContent className="pt-10 pb-10 text-center text-[13px] text-muted-foreground">{t("noDocs")}</CardContent></Card>
          )}
        </div>

        {selectedDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedDoc(null)}>
            <Card className="max-w-2xl w-full bg-background" onClick={(e) => e.stopPropagation()}>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedDoc.name}</h2>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Uploaded: {new Date(selectedDoc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedDoc(null)}>
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-muted-foreground">File Type Classification</label>
                  <div className="flex items-center gap-3 p-3 rounded-md bg-accent/50 border">
                    <TypeBadge kind={(selectedDoc.doc_type as any) || classifyFile(selectedDoc.name)} />
                    <div className="text-[13px]">
                      {(selectedDoc.doc_type || classifyFile(selectedDoc.name)) === "structured" ? (
                        <div>
                          <p className="font-medium text-emerald-700">Structured Data</p>
                          <p className="text-muted-foreground">CSV, TSV, XLSX, JSON - tabular/record format with keys and values.</p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-sky-700">Unstructured Text</p>
                          <p className="text-muted-foreground">PDF, DOCX, TXT, MD - free-form prose and documents.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[13px]">
                  <div className="p-3 rounded-md bg-muted/40">
                    <p className="text-muted-foreground mb-1">Content Hash</p>
                    <p className="font-mono text-[11px] break-all">{selectedDoc.content_hash}</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/40">
                    <p className="text-muted-foreground mb-1">Description</p>
                    <p>{selectedDoc.description || "—"}</p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-[12px] text-muted-foreground mb-3">Processing Details</p>
                  <div className="text-[13px] space-y-1">
                    {(selectedDoc.doc_type || classifyFile(selectedDoc.name)) === "structured" && (
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Data is converted to key:value format</li>
                        <li>Chunked into semantic segments</li>
                        <li>Embedded for vector search</li>
                        <li>Available for RAG queries</li>
                      </ul>
                    )}
                    {(selectedDoc.doc_type || classifyFile(selectedDoc.name)) === "unstructured" && (
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Text extracted from document format</li>
                        <li>Chunked by paragraph boundaries</li>
                        <li>Embedded for vector search</li>
                        <li>Available for RAG queries</li>
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => setSelectedDoc(null)}>Close</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </>
    ) : (
      <div className="space-y-4">
        {loadingGraph ? (
          <div className="h-[600px] flex flex-col items-center justify-center bg-slate-950/20 rounded-xl border border-slate-900 text-sm text-muted-foreground">
            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            กำลังดึงข้อมูลและจำลองโครงข่ายความรู้...
          </div>
        ) : (
          <GraphVisualizer data={graphData} onRefresh={loadGraph} />
        )}
      </div>
    )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
              <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                {t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
