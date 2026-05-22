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
import { AlertCircle, Eye, Trash2, Image, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { detectCapabilities } from "@/lib/modelCapabilities";

export default function ModelsPage() {
  const t = useTranslations("ModelsPage");
  const [providers, setProviders] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [available, setAvailable] = useState<{ id: string; display: string }[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [availErr, setAvailErr] = useState("");
  const [manual, setManual] = useState(false);
  const [editingModel, setEditingModel] = useState<any | null>(null);
  const [form, setForm] = useState({
    provider_id: 0, model_id: "", display_name: "",
    context_window: 8192, input_cost_per_1k: 0, output_cost_per_1k: 0, supports_vision: false, supports_image_generation: false,
  });
  const [editForm, setEditForm] = useState({
    display_name: "",
    context_window: 8192,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    supports_vision: false,
    supports_image_generation: false,
  });
  const [err, setErr] = useState("");
  const [editErr, setEditErr] = useState("");
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
    try {
      const r = await llm.availableModels(id);
      setAvailable(r.models.map((m: { id: string; display: string; capabilities?: string[] }) => ({
        ...m,
        capabilities: m.capabilities && m.capabilities.length > 0
          ? m.capabilities
          : detectCapabilities(m.id),
      })));
    }
    catch (e: any) { setAvailErr(e.message); }
    finally { setLoadingAvail(false); }
  }

  async function startEdit(model: any) {
    setEditingModel(model);
    const caps = detectCapabilities(model.model_id);
    setEditForm({
      display_name: model.display_name,
      context_window: model.context_window,
      input_cost_per_1k: model.input_cost_per_1k,
      output_cost_per_1k: model.output_cost_per_1k,
      supports_vision: caps.includes("vision"),
      supports_image_generation: caps.includes("image gen"),
    });
    setEditErr("");
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await llm.createModel(form);
      setForm({
        provider_id: 0, model_id: "", display_name: "",
        context_window: 8192, input_cost_per_1k: 0, output_cost_per_1k: 0, supports_vision: false, supports_image_generation: false,
      });
      setAvailable([]);
      setManual(false);
      load();
    } catch (e: any) { setErr(e.message); }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingModel) return;
    try {
      await llm.updateModel(editingModel.id, editForm);
      setEditingModel(null);
      load();
    } catch (e: any) { setEditErr(e.message); }
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
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 pb-10 max-w-5xl mx-auto">

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={submitCreate} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("provider")}</Label>
                <Select value={String(form.provider_id)} onValueChange={(v) => pickProvider(Number(v))}>
                  <SelectTrigger><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("modelId")}</Label>
                  {form.provider_id > 0 && (
                    <button type="button" onClick={() => setManual((m) => !m)}
                            className="text-[10.5px] text-primary hover:underline">
                      {manual ? t("selectFromList") : t("typeManually")}
                    </button>
                  )}
                </div>
                {!manual && form.provider_id > 0 ? (
                  <SearchableSelect
                    value={form.model_id}
                    onValueChange={(v) => {
                      const selected = available.find((m) => m.id === v);
                      const caps = detectCapabilities(v);
                      setForm((f) => ({
                        ...f,
                        model_id: v,
                        display_name: f.display_name || selected?.display || "",
                        supports_vision: caps.includes("vision"),
                        supports_image_generation: caps.includes("image gen"),
                      }));
                    }}
                    options={available}
                    placeholder={loadingAvail ? t("loading") : available.length === 0 ? t("noModelsAvailable") : t("selectCountModels", { count: available.length })}
                    searchPlaceholder={t("searchModels")}
                    disabled={loadingAvail || available.length === 0}
                  />
                ) : (
                  <Input className="font-mono" placeholder="gpt-4o-mini" required
                         value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} />
                )}
                {availErr && <p className="text-[10.5px] text-destructive">⚠ {availErr}</p>}
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label>{t("displayName")}</Label>
                <Input placeholder="GPT-4o Mini" value={form.display_name}
                       onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("contextWindow")}</Label>
                <Input type="number" value={form.context_window}
                       onChange={(e) => setForm({ ...form, context_window: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("inputCost")}</Label>
                  <Input type="number" step="0.0001" value={form.input_cost_per_1k}
                         onChange={(e) => setForm({ ...form, input_cost_per_1k: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("outputCost")}</Label>
                  <Input type="number" step="0.0001" value={form.output_cost_per_1k}
                         onChange={(e) => setForm({ ...form, output_cost_per_1k: Number(e.target.value) })} />
                </div>
              </div>

              {err && (
                <Alert variant="destructive" className="sm:col-span-2">
                  <AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <div className="sm:col-span-2">
                <Button type="submit">{t("addModel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("provider"), t("modelId"), t("displayName"), "in $/1k", "out $/1k", "Capabilities", ""].map((h, i) => (
                  <th key={i} className={`${i === 3 || i === 4 ? "text-right" : "text-left"} px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground`}>{h}</th>
                ))}
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
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[11px]">text</Badge>
                        {m.supports_vision && <Badge variant="success" className="text-[11px]"><Eye className="size-3 mr-1" />vision</Badge>}
                        {m.supports_image_generation && <Badge variant="secondary" className="text-[11px]"><Image className="size-3 mr-1" />image gen</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-accent transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: m.id, name: m.display_name || m.model_id })}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-accent transition-colors cursor-pointer"
                          title={t("confirmDelete")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {models.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-6">{t("noModels")}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={!!editingModel} onOpenChange={(open) => !open && setEditingModel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>
              {editingModel?.model_id}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("displayName")}</Label>
              <Input placeholder="GPT-4o Mini" value={editForm.display_name}
                     onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>{t("contextWindow")}</Label>
              <Input type="number" value={editForm.context_window}
                     onChange={(e) => setEditForm({ ...editForm, context_window: Number(e.target.value) })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("inputCost")}</Label>
                <Input type="number" step="0.0001" value={editForm.input_cost_per_1k}
                       onChange={(e) => setEditForm({ ...editForm, input_cost_per_1k: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("outputCost")}</Label>
                <Input type="number" step="0.0001" value={editForm.output_cost_per_1k}
                       onChange={(e) => setEditForm({ ...editForm, output_cost_per_1k: Number(e.target.value) })} />
              </div>
            </div>

            {editErr && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" /><AlertDescription>{editErr}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setEditingModel(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmDeleteDesc", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" type="button" onClick={confirmDelete}>
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
