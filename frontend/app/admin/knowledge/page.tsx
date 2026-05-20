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
import { AlertCircle, Upload, FileText, Link2, X } from "lucide-react";

export default function KnowledgePage() {
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
    alert("ผูกเอกสารกับ Agent เรียบร้อย");
  }

  async function deprecate(id: number) {
    if (!confirm("ปลดเอกสารนี้?")) return;
    await knowledge.deprecate(id); load();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  }

  return (
    <section>
      <PageHeader title="Knowledge" subtitle="อัปโหลดเอกสารเพื่อใช้เป็นฐานความรู้ของ Agent (RAG)" />
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
                <input ref={inputRef} type="file" accept=".pdf,.txt,.md,.docx,.csv" className="hidden"
                       onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Upload className="size-7 mx-auto text-muted-foreground mb-2" />
                <div className="text-[13px] font-medium text-foreground">
                  {file ? file.name : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก"}
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-1">รองรับ PDF, DOCX, TXT, MD, CSV</div>
              </label>

              <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>คำอธิบาย (ไม่จำเป็น)</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="เช่น คู่มือพนักงาน 2026" />
                </div>
                <Button disabled={!file || busy}>
                  {busy ? "กำลังประมวลผล…" : "อัปโหลด + Embed"}
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
            <span className="text-[13px] font-medium">ผูกกับ Agent:</span>
            <Select value={bindAgent} onValueChange={setBindAgent}>
              <SelectTrigger className="w-56 h-8"><SelectValue placeholder="— เลือก Agent —" /></SelectTrigger>
              <SelectContent>
                {ags.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[10.5px] text-muted-foreground">เลือก Agent ก่อน แล้วกดปุ่ม "ผูก" ที่เอกสาร</span>
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
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-[10.5px] text-muted-foreground font-mono truncate">
                    {d.description || "ไม่มีคำอธิบาย"} · hash {d.content_hash.slice(0, 10)}…
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!bindAgent} onClick={() => doBind(d.id)}>
                    <Link2 className="size-3.5" /> ผูก
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deprecate(d.id)}>
                    <X className="size-3.5" /> ปลด
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {docs.length === 0 && (
            <Card><CardContent className="pt-10 pb-10 text-center text-[13px] text-muted-foreground">ยังไม่มีเอกสาร</CardContent></Card>
          )}
        </div>
      </div>
    </section>
  );
}
