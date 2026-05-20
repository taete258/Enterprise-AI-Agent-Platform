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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AlertCircle, Eye, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ModelsPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [available, setAvailable] = useState<{ id: string; display: string }[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [availErr, setAvailErr] = useState("");
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({
    provider_id: 0, model_id: "", display_name: "",
    context_window: 8192, input_cost_per_1k: 0, output_cost_per_1k: 0, supports_vision: false,
  });
  const [err, setErr] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  async function load() {
    setProviders(await llm.providers());
    setModels(await llm.models());
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function pickProvider(id: number) {
    setForm((f) => ({ ...f, provider_id: id, model_id: "" }));
    setAvailable([]); setAvailErr(""); setManual(false);
    if (!id) return;
    setLoadingAvail(true);
    try { const r = await llm.availableModels(id); setAvailable(r.models); }
    catch (e: any) { setAvailErr(e.message); }
    finally { setLoadingAvail(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await llm.createModel(form);
      setForm({ ...form, model_id: "", display_name: "" });
      load();
    } catch (e: any) { setErr(e.message); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await llm.deleteModel(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setErr(e.message);
      setDeleteTarget(null);
    }
  }

  return (
    <section>
      <PageHeader title="Models" subtitle="กำหนดโมเดล AI ที่ Agent สามารถใช้งานได้" />
      <div className="px-6 pb-10 max-w-5xl mx-auto">

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Provider</Label>
                <Select value={String(form.provider_id)} onValueChange={(v) => pickProvider(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="— เลือก —" /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Model ID</Label>
                  {form.provider_id > 0 && (
                    <button type="button" onClick={() => setManual((m) => !m)}
                            className="text-[10.5px] text-primary hover:underline">
                      {manual ? "← เลือกจากรายการ" : "พิมพ์เอง →"}
                    </button>
                  )}
                </div>
                {!manual && form.provider_id > 0 ? (
                  <SearchableSelect
                    value={form.model_id}
                    onValueChange={(v) => {
                      const selected = available.find((m) => m.id === v);
                      setForm((f) => ({
                        ...f,
                        model_id: v,
                        display_name: f.display_name || selected?.display || "",
                      }));
                    }}
                    options={available}
                    placeholder={loadingAvail ? "Loading..." : available.length === 0 ? "- No models available -" : `- Select (${available.length} models) -`}
                    searchPlaceholder="Search models..."
                    disabled={loadingAvail || available.length === 0}
                  />
                ) : (
                  <Input className="font-mono" placeholder="gpt-4o-mini" required
                         value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} />
                )}
                {availErr && <p className="text-[10.5px] text-destructive">⚠ {availErr}</p>}
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label>ชื่อแสดง</Label>
                <Input placeholder="GPT-4o Mini" value={form.display_name}
                       onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>Context window (tokens)</Label>
                <Input type="number" value={form.context_window}
                       onChange={(e) => setForm({ ...form, context_window: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Input $ / 1k</Label>
                  <Input type="number" step="0.0001" value={form.input_cost_per_1k}
                         onChange={(e) => setForm({ ...form, input_cost_per_1k: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Output $ / 1k</Label>
                  <Input type="number" step="0.0001" value={form.output_cost_per_1k}
                         onChange={(e) => setForm({ ...form, output_cost_per_1k: Number(e.target.value) })} />
                </div>
              </div>

              <label className="sm:col-span-2 flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="accent-primary w-4 h-4"
                       checked={form.supports_vision}
                       onChange={(e) => setForm({ ...form, supports_vision: e.target.checked })} />
                รองรับ Vision (รูปภาพ)
              </label>

              {err && (
                <Alert variant="destructive" className="sm:col-span-2">
                  <AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <div className="sm:col-span-2"><Button>+ เพิ่ม Model</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Provider</th>
                <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Model ID</th>
                <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">ชื่อแสดง</th>
                <th className="text-right px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">in $/1k</th>
                <th className="text-right px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">out $/1k</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const p = providers.find((p) => p.id === m.provider_id);
                return (
                  <tr key={m.id} className="border-b border-border hover:bg-accent/40">
                    <td className="px-3 py-2.5">{p?.name ?? m.provider_id}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px]">{m.model_id}</td>
                    <td className="px-3 py-2.5">{m.display_name || "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{m.input_cost_per_1k}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{m.output_cost_per_1k}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {m.supports_vision && <Badge variant="success"><Eye className="size-3 mr-1" /> vision</Badge>}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: m.id, name: m.display_name || m.model_id })}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-accent transition-colors cursor-pointer"
                          title="ลบโมเดล"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {models.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">ยังไม่มี Model</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete Model</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the model <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>? This action will remove the model from active selections.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={confirmDelete}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
