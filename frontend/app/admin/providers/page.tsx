"use client";
import { useEffect, useState } from "react";
import { llm } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, AlertCircle, Plug, Loader2, Pencil } from "lucide-react";

const KINDS = [
  { v: "openai",     label: "OpenAI" },
  { v: "anthropic",  label: "Anthropic" },
  { v: "openrouter", label: "OpenRouter" },
  { v: "local",      label: "Local (OpenAI-compatible)" },
];

type TestState = { status: "idle" | "testing" | "ok" | "fail"; msg?: string };

export default function ProvidersPage() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", kind: "openai", base_url: "", api_key: "" });
  const [createTest, setCreateTest] = useState<TestState>({ status: "idle" });
  const [tests, setTests] = useState<Record<number, TestState>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", base_url: "", api_key: "", is_active: true });
  const [editTest, setEditTest] = useState<TestState>({ status: "idle" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() { setList(await llm.providers()); }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function testNew() {
    if (!form.api_key && form.kind !== "local") {
      setCreateTest({ status: "fail", msg: "กรุณาใส่ API Key ก่อน" });
      return;
    }
    setCreateTest({ status: "testing" });
    try {
      const r = await llm.testConfig({ kind: form.kind, base_url: form.base_url, api_key: form.api_key });
      setCreateTest(r.ok
        ? { status: "ok", msg: r.model_count != null ? `พบ ${r.model_count} โมเดล` : r.probe_model ? `probe: ${r.probe_model}` : "พร้อมใช้งาน" }
        : { status: "fail", msg: r.error || "ไม่ทราบสาเหตุ" });
    } catch (e: any) { setCreateTest({ status: "fail", msg: e.message }); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (createTest.status !== "ok") { setErr("ต้องทดสอบการเชื่อมต่อสำเร็จก่อน"); return; }
    setBusy(true); setErr("");
    try {
      await llm.createProvider(form);
      setForm({ name: "", kind: "openai", base_url: "", api_key: "" });
      setCreateTest({ status: "idle" });
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function startEdit(p: any) {
    setEditing(p.id);
    setEditForm({ name: p.name, base_url: p.base_url || "", api_key: "", is_active: p.is_active });
    setEditTest({ status: "idle" });
  }

  async function testEdit(id: number, kind: string) {
    setEditTest({ status: "testing" });
    try {
      const r = editForm.api_key
        ? await llm.testConfig({ kind, base_url: editForm.base_url, api_key: editForm.api_key })
        : await llm.testProvider(id);
      setEditTest(r.ok
        ? { status: "ok", msg: r.model_count != null ? `พบ ${r.model_count} โมเดล` : r.probe_model ? `probe: ${r.probe_model}` : "พร้อมใช้งาน" }
        : { status: "fail", msg: r.error || "ไม่ทราบสาเหตุ" });
    } catch (e: any) { setEditTest({ status: "fail", msg: e.message }); }
  }

  async function saveEdit(id: number) {
    setBusy(true);
    try { await llm.updateProvider(id, editForm); setEditing(null); setEditTest({ status: "idle" }); load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function runTest(id: number) {
    setTests((t) => ({ ...t, [id]: { status: "testing" } }));
    try {
      const r = await llm.testProvider(id);
      setTests((t) => ({ ...t, [id]: r.ok
        ? { status: "ok",   msg: r.model_count != null ? `พบ ${r.model_count} โมเดล` : r.probe_model ? `probe: ${r.probe_model}` : "พร้อมใช้งาน" }
        : { status: "fail", msg: r.error || "ไม่ทราบสาเหตุ" } }));
    } catch (e: any) { setTests((t) => ({ ...t, [id]: { status: "fail", msg: e.message } })); }
  }

  async function del(id: number) {
    if (!confirm("ลบ provider นี้?")) return;
    await llm.deleteProvider(id); load();
  }

  return (
    <section>
      <PageHeader title="Providers" subtitle="จัดการการเชื่อมต่อกับผู้ให้บริการโมเดล AI" />
      <div className="px-6 pb-10 max-w-5xl mx-auto">

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>ชื่อ Provider</Label>
                  <Input placeholder="เช่น openai-corp" required value={form.name}
                         onChange={(e) => { setForm({ ...form, name: e.target.value }); setCreateTest({ status: "idle" }); }} />
                </div>
                <div className="space-y-1.5">
                  <Label>ประเภท</Label>
                  <Select value={form.kind} onValueChange={(v) => { setForm({ ...form, kind: v }); setCreateTest({ status: "idle" }); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Base URL (ไม่จำเป็น)</Label>
                  <Input placeholder="https://api.openai.com/v1" value={form.base_url}
                         onChange={(e) => { setForm({ ...form, base_url: e.target.value }); setCreateTest({ status: "idle" }); }} />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>API Key</Label>
                  <Input className="font-mono" type="password" placeholder="sk-…" value={form.api_key}
                         onChange={(e) => { setForm({ ...form, api_key: e.target.value }); setCreateTest({ status: "idle" }); }} />
                  <p className="text-[10.5px] text-muted-foreground">🔒 เข้ารหัสด้วย Fernet ก่อนเก็บลงฐานข้อมูล</p>
                </div>
              </div>

              <TestBanner state={createTest} />

              <Separator />

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={testNew} disabled={createTest.status === "testing"}>
                  {createTest.status === "testing" && <Loader2 className="size-4 animate-spin" />}
                  <Plug className="size-4" /> Test connection
                </Button>
                <Button type="submit" disabled={createTest.status !== "ok" || busy}>
                  {busy ? "กำลังเพิ่ม…" : "เพิ่ม Provider"}
                </Button>
                {createTest.status !== "ok" && (
                  <span className="text-[10.5px] text-muted-foreground ml-1">ต้องทดสอบสำเร็จก่อนจึงจะเพิ่มได้</span>
                )}
              </div>

              {err && (
                <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription></Alert>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <CardContent className="pt-6 text-center text-[13px] text-muted-foreground">ยังไม่มี Provider</CardContent>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((p) => {
                const t = tests[p.id] ?? { status: "idle" as const };
                const isEdit = editing === p.id;
                return (
                  <li key={p.id} className="px-5 py-4">
                    {!isEdit ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-md bg-accent text-accent-foreground grid place-items-center text-sm font-serif font-semibold">
                              {p.kind[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium flex items-center gap-2">
                                {p.name}
                                <Badge variant="muted">{p.kind}</Badge>
                                {t.status === "ok"      && <Badge variant="success">● online</Badge>}
                                {t.status === "fail"    && <Badge variant="destructive">● offline</Badge>}
                                {t.status === "testing" && <Badge variant="warning">⟳ testing</Badge>}
                              </div>
                              <div className="text-[10.5px] text-muted-foreground font-mono truncate">{p.base_url || "default endpoint"}</div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => runTest(p.id)} disabled={t.status === "testing"}>
                              {t.status === "testing" && <Loader2 className="size-3.5 animate-spin" />} Test
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                              <Pencil className="size-3.5" /> Edit
                            </Button>
                            <Button size="sm" variant="ghost"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => del(p.id)}>Delete</Button>
                          </div>
                        </div>
                        {t.msg && (
                          <Alert variant={t.status === "ok" ? "success" : "destructive"} className="mt-2">
                            <AlertDescription className="flex items-center gap-2">
                              {t.status === "ok" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                              {t.msg}
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="section-h">Editing · {p.kind}</div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>ชื่อ</Label>
                            <Input value={editForm.name}
                                   onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                          </div>
                          <label className="flex items-center gap-2 pt-7 text-[13px]">
                            <input type="checkbox" className="accent-primary w-4 h-4"
                                   checked={editForm.is_active}
                                   onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
                            Active
                          </label>
                          <div className="sm:col-span-2 space-y-1.5">
                            <Label>Base URL</Label>
                            <Input placeholder="https://api.openai.com/v1" value={editForm.base_url}
                                   onChange={(e) => setEditForm({ ...editForm, base_url: e.target.value })} />
                          </div>
                          <div className="sm:col-span-2 space-y-1.5">
                            <Label>API Key (เว้นว่าง = ใช้คีย์เดิม)</Label>
                            <Input className="font-mono" type="password" placeholder="sk-…" value={editForm.api_key}
                                   onChange={(e) => setEditForm({ ...editForm, api_key: e.target.value })} />
                          </div>
                        </div>
                        <TestBanner state={editTest} />
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" onClick={() => testEdit(p.id, p.kind)} disabled={editTest.status === "testing"}>
                            {editTest.status === "testing" && <Loader2 className="size-4 animate-spin" />} Test
                          </Button>
                          <Button type="button" onClick={() => saveEdit(p.id)} disabled={busy}>
                            {busy ? "Saving…" : "Save"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => { setEditing(null); setEditTest({ status: "idle" }); }}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}

function TestBanner({ state }: { state: TestState }) {
  if (state.status === "idle") return null;
  const variant = state.status === "ok" ? "success"
                : state.status === "testing" ? "warning"
                : "destructive";
  const Icon = state.status === "ok" ? Check
             : state.status === "testing" ? Loader2
             : X;
  return (
    <Alert variant={variant as any}>
      <Icon className={`size-4 ${state.status === "testing" ? "animate-spin" : ""}`} />
      <AlertDescription>{state.status === "testing" ? "กำลังทดสอบการเชื่อมต่อ…" : state.msg}</AlertDescription>
    </Alert>
  );
}
