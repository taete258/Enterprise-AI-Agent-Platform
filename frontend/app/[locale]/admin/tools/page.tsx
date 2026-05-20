"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trash2, Edit2, Play, Plus, BookOpen, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

const SCHEMA_TEMPLATES = {
  empty: `{\n  "type": "object",\n  "properties": {},\n  "required": []\n}`,
  weather: `{\n  "type": "object",\n  "properties": {\n    "city": {\n      "type": "string",\n      "description": "City name, e.g. Bangkok"\n    }\n  },\n  "required": [\n    "city"\n  ]\n}`,
  generic_get: `{\n  "type": "object",\n  "properties": {\n    "query": {\n      "type": "string",\n      "description": "Search query or filter text"\n    }\n  },\n  "required": []\n}`
};

export default function ToolsPage() {
  const t = useTranslations("ToolsPage");
  const [tools, setTools] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", key: "", description: "", type: "api",
    url: "", method: "GET", headers: "{}", schema_json: SCHEMA_TEMPLATES.empty
  });

  const [testTarget, setTestTarget] = useState<any | null>(null);
  const [testParams, setTestParams] = useState("{}");
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  async function load() {
    try {
      setLoading(true);
      setTools(await admin.listTools());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleOpenCreate() {
    setEditingTool(null);
    setForm({ name: "", key: "", description: "", type: "api", url: "", method: "GET", headers: "{}", schema_json: SCHEMA_TEMPLATES.empty });
    setErr(""); setDialogOpen(true);
  }

  function handleOpenEdit(tool: any) {
    setEditingTool(tool);
    setForm({
      name: tool.name, key: tool.key, description: tool.description, type: tool.type,
      url: tool.url || "", method: tool.method || "GET", headers: tool.headers || "{}",
      schema_json: tool.schema_json || SCHEMA_TEMPLATES.empty
    });
    setErr(""); setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      try { JSON.parse(form.schema_json); } catch (e) { throw new Error("Invalid JSON in Parameters Schema"); }
      try { JSON.parse(form.headers); } catch (e) { throw new Error("Invalid JSON in HTTP Headers config"); }
      if (editingTool) { await admin.updateTool(editingTool.id, form); }
      else { await admin.createTool(form); }
      setDialogOpen(false); load();
    } catch (e: any) { setErr(e.message); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try { await admin.deleteTool(deleteTarget.id); setDeleteTarget(null); load(); }
    catch (e: any) { setErr(e.message); setDeleteTarget(null); }
  }

  function handleOpenTest(tool: any) {
    setTestTarget(tool); setTestResult(null);
    try {
      const parsed = JSON.parse(tool.schema_json);
      const props = parsed.properties || {};
      const prep: Record<string, any> = {};
      Object.keys(props).forEach((k) => {
        prep[k] = props[k].type === "number" || props[k].type === "integer" ? 0 : "";
      });
      setTestParams(JSON.stringify(prep, null, 2));
    } catch (e) { setTestParams("{}"); }
  }

  async function runTest() {
    if (!testTarget) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await admin.testTool({
        url: testTarget.url || `/api/mock/weather`,
        method: testTarget.method || "GET",
        headers: testTarget.headers || "{}",
        parameters: testParams
      });
      setTestResult(res);
    } catch (e: any) { setTestResult({ ok: false, error: e.message }); }
    finally { setTesting(false); }
  }

  return (
    <section className="pb-12">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 max-w-5xl mx-auto space-y-6">
        {err && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center">
          <h2 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">{t("availableSkills")}</h2>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="size-4" /> {t("createSkill")}
          </Button>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("name"), t("key"), t("description"), t("type"), ""].map((h, i) => (
                  <th key={i} className={`text-left px-4 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground ${i === 0 ? "w-1/4" : i === 1 ? "w-1/5" : i === 2 ? "w-1/3" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id} className="border-b border-border hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{tool.name}</td>
                  <td className="px-4 py-3"><code className="text-[12px] bg-muted px-1.5 py-0.5 rounded text-primary">{tool.key}</code></td>
                  <td className="px-4 py-3 text-muted-foreground line-clamp-2 max-w-xs">{tool.description}</td>
                  <td className="px-4 py-3">
                    {tool.type === "system" ? (
                      <Badge variant="secondary" className="gap-1"><Settings className="size-3" /> {t("system")}</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-primary text-primary"><BookOpen className="size-3" /> {t("api")}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="icon" variant="ghost" onClick={() => handleOpenTest(tool)} title="Test Tool" className="size-8 text-primary hover:text-primary-hover hover:bg-primary/10 cursor-pointer">
                        <Play className="size-3.5 fill-current" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(tool)} title="Edit Tool" className="size-8 text-muted-foreground hover:text-foreground cursor-pointer">
                        <Edit2 className="size-3.5" />
                      </Button>
                      {!tool.is_system && (
                        <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(tool)} title="Delete Tool" className="size-8 text-muted-foreground hover:text-destructive cursor-pointer">
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tools.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">{t("noTools")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingTool ? t("editSkill") : t("createNewSkill")}</DialogTitle>
              <DialogDescription>{t("skillIntro")}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="tool-name">{t("skillName")}</Label>
                <Input id="tool-name" placeholder={t("skillNamePlaceholder")} required value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="tool-key">{t("functionKey")}</Label>
                <Input id="tool-key" placeholder={t("functionKeyPlaceholder")} required
                       disabled={!!editingTool && editingTool.is_system} value={form.key}
                       onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="tool-desc">{t("descInstruction")}</Label>
                <textarea id="tool-desc" className="w-full min-h-[70px] rounded-md border border-input bg-transparent px-3 py-2 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder={t("descInstructionPlaceholder")} required value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="tool-type">{t("type")}</Label>
                <select id="tool-type" disabled={!!editingTool && editingTool.is_system}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, url: e.target.value === "system" ? "" : form.url })}>
                  <option value="api">{t("apiOption")}</option>
                  <option value="system">{t("systemOption")}</option>
                </select>
              </div>

              {form.type === "api" && (
                <>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <Label htmlFor="tool-method">{t("httpMethod")}</Label>
                    <select id="tool-method" className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                      {["GET","POST","PUT","PATCH","DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="tool-url">{t("endpointUrl")}</Label>
                    <Input id="tool-url" placeholder="e.g. /api/mock/hr/leaves" required={form.type === "api"} value={form.url}
                           onChange={(e) => setForm({ ...form, url: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="tool-headers">{t("defaultHeaders")}</Label>
                    <textarea id="tool-headers" className="w-full min-h-[60px] font-mono text-[11.5px] rounded-md border border-input bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder='{ "Authorization": "Bearer key-here" }' value={form.headers}
                              onChange={(e) => setForm({ ...form, headers: e.target.value })} />
                  </div>
                </>
              )}

              <div className="space-y-1.5 col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tool-schema">{t("parametersSchema")}</Label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm({ ...form, schema_json: SCHEMA_TEMPLATES.weather })} className="text-[10px] text-primary hover:underline">{t("weatherTemplate")}</button>
                    <button type="button" onClick={() => setForm({ ...form, schema_json: SCHEMA_TEMPLATES.empty })} className="text-[10px] text-primary hover:underline">{t("emptySchema")}</button>
                  </div>
                </div>
                <textarea id="tool-schema" className="w-full min-h-[140px] font-mono text-[11.5px] rounded-md border border-input bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          required value={form.schema_json} onChange={(e) => setForm({ ...form, schema_json: e.target.value })} />
              </div>
            </div>

            {err && (
              <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription></Alert>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingTool ? t("saveChanges") : t("createSkill")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteSkill")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" type="button" onClick={confirmDelete}>{t("confirmDelete") ?? "Confirm Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={!!testTarget} onOpenChange={(open) => !open && setTestTarget(null)}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("testSkill", { name: testTarget?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("testIntro")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2 w-full min-w-0 overflow-hidden">
            <div className="space-y-1.5 w-full min-w-0">
              <Label>{t("testArguments")}</Label>
              <textarea className="w-full min-h-[90px] font-mono text-[11.5px] rounded-md border border-input bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={testParams} onChange={(e) => setTestParams(e.target.value)} />
            </div>
            <Button onClick={runTest} disabled={testing} className="w-full">
              {testing ? t("executing") : t("runTest")}
            </Button>
            {testResult && (
              <div className="space-y-1.5 w-full min-w-0">
                <Label>{t("executionResult")}</Label>
                <div className={`p-3 rounded-md text-[12px] font-mono overflow-y-auto overflow-x-hidden max-h-[180px] border w-full min-w-0 ${testResult.ok ? "bg-accent/30 border-border text-foreground" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
                  {testResult.ok ? (
                    <div className="w-full min-w-0">
                      <p className="text-muted-foreground mb-1 text-[11.5px]">{t("httpStatus", { status: testResult.status })}</p>
                      <pre className="whitespace-pre-wrap break-all w-full text-[11.5px] font-mono leading-relaxed">{testResult.body}</pre>
                    </div>
                  ) : (
                    <p className="break-all">{testResult.error || t("executionFailed")}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" type="button" onClick={() => setTestTarget(null)}>{t("closeDrawer")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
