"use client";
import { useEffect, useState, useCallback } from "react";
import { admin } from "@/lib/api";
import { PageHeader, Button, Input, Label, Card, CardContent, Badge, Alert, AlertDescription, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@taete258/ds";
import { AlertCircle, Trash2, Edit2, Play, Plus, BookOpen, Settings } from "lucide-react";
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

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Filter state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", key: "", description: "", type: "api",
    url: "", method: "GET", headers: "{}", schema_json: SCHEMA_TEMPLATES.empty,
    capabilities: ["text"],
    cost_per_1m_input_tokens: 0,
    cost_per_1m_output_tokens: 0
  });

  const [testTarget, setTestTarget] = useState<any | null>(null);
  const [testParams, setTestParams] = useState("{}");
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: (page * pageSize).toString(),
        limit: pageSize.toString(),
        ...(search && { search }),
        ...(typeFilter && { type: typeFilter }),
      });

      const response = await admin.listTools(Object.fromEntries(params));
      if (Array.isArray(response)) {
        // Backward compatibility: if API returns array, paginate locally
        const filtered = response.filter((tool) => {
          if (search && !tool.name.toLowerCase().includes(search.toLowerCase()) &&
              !tool.description?.toLowerCase().includes(search.toLowerCase())) return false;
          if (typeFilter && tool.type !== typeFilter) return false;
          return true;
        });
        setTotal(filtered.length);
        setTools(filtered.slice(page * pageSize, (page + 1) * pageSize));
      } else {
        // New API returns paginated response
        setTools(response.items || []);
        setTotal(response.total || 0);
      }
      setErr("");
    } catch (e: any) {
      setErr(e.message);
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, typeFilter]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  function handleOpenCreate() {
    setEditingTool(null);
    setForm({ name: "", key: "", description: "", type: "api", url: "", method: "GET", headers: "{}", schema_json: SCHEMA_TEMPLATES.empty, capabilities: ["text"], cost_per_1m_input_tokens: 0, cost_per_1m_output_tokens: 0 });
    setErr(""); setDialogOpen(true);
  }

  function handleOpenEdit(tool: any) {
    setEditingTool(tool);
    setForm({
      name: tool.name, key: tool.key, description: tool.description, type: tool.type,
      url: tool.url || "", method: tool.method || "GET", headers: tool.headers || "{}",
      schema_json: tool.schema_json || SCHEMA_TEMPLATES.empty,
      capabilities: tool.capabilities || ["text"],
      cost_per_1m_input_tokens: tool.cost_per_1m_input_tokens || 0,
      cost_per_1m_output_tokens: tool.cost_per_1m_output_tokens || 0
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
      setDialogOpen(false); setPage(0); fetchTools();
    } catch (e: any) { setErr(e.message); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try { await admin.deleteTool(deleteTarget.id); setDeleteTarget(null); setPage(0); fetchTools(); }
    catch (e: any) { setErr(e.message); setDeleteTarget(null); }
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(0);
    fetchTools();
  };

  const handleClearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setPage(0);
  };

  const totalPages = Math.ceil(total / pageSize);

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
      <div className="px-6 max-w-6xl mx-auto space-y-4">
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

        {/* Filters */}
        <Card className="p-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                type="text"
                placeholder="Search by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-[13px]"
              />

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(0);
                }}
                className="text-[13px] px-3 py-2 rounded-md border border-input bg-background h-9"
              >
                <option value="">All Types</option>
                <option value="api">API</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm" className="text-[13px]" disabled={loading}>
                {loading ? "..." : "Search"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[13px]"
                onClick={handleClearFilters}
              >
                Clear
              </Button>
            </div>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("name"), t("key"), t("description"), t("type"), "Capabilities", "Cost", ""].map((h, i) => (
                  <th key={i} className={`text-left px-4 py-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground ${i === 0 ? "w-1/5" : i === 1 ? "w-1/6" : i === 2 ? "w-1/4" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id} className="border-b border-border hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-4 font-medium text-foreground">{tool.name}</td>
                  <td className="px-4 py-4"><code className="text-[12px] bg-muted px-1.5 py-0.5 rounded text-primary">{tool.key}</code></td>
                  <td className="px-4 py-4 text-muted-foreground line-clamp-3">{tool.description}</td>
                  <td className="px-4 py-4">
                    {tool.type === "system" ? (
                      <Badge variant="secondary" className="gap-1"><Settings className="size-3" /> {t("system")}</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-primary text-primary"><BookOpen className="size-3" /> {t("api")}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {tool.capabilities && tool.capabilities.length > 0 ? (
                        tool.capabilities.map((cap: string) => (
                          <Badge key={cap} variant="outline" className="text-[11px] capitalize">
                            {cap}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[12px]">
                    <div className="space-y-0.5">
                      <div className="text-muted-foreground">
                        <span className="font-medium">In:</span> ${(tool.cost_per_1m_input_tokens || 0).toFixed(4)}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-medium">Out:</span> ${(tool.cost_per_1m_output_tokens || 0).toFixed(4)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
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
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">{t("noTools")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-[13px] text-muted-foreground">
              Showing {tools.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0 || loading}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-[12px]">
                {page > 2 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(0)}
                      disabled={loading}
                      className="min-w-8"
                    >
                      1
                    </Button>
                    <span className="text-muted-foreground">...</span>
                  </>
                )}
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const pageNum = page <= 2 ? i : Math.min(page - 2 + i, totalPages - 1);
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      disabled={loading}
                      className="min-w-8"
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
                {page < totalPages - 3 && (
                  <>
                    <span className="text-muted-foreground">...</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages - 1)}
                      disabled={loading}
                      className="min-w-8"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1 || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
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

              <div className="space-y-1.5 col-span-2">
                <Label>Model Capabilities</Label>
                <div className="flex gap-3 flex-wrap p-3 rounded-md border border-input bg-transparent">
                  {["text", "image", "audio", "video"].map((cap) => (
                    <label key={cap} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.capabilities?.includes(cap) || false}
                        onChange={(e) => {
                          const caps = form.capabilities || [];
                          setForm({
                            ...form,
                            capabilities: e.target.checked
                              ? [...caps, cap]
                              : caps.filter((c) => c !== cap)
                          });
                        }}
                        className="rounded border border-input"
                      />
                      <span className="text-[13px] capitalize">{cap}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 col-span-2">
                <div className="space-y-1.5">
                  <Label htmlFor="input-cost">Cost per 1M Input Tokens ($)</Label>
                  <Input
                    id="input-cost"
                    type="number"
                    step="0.0001"
                    placeholder="0.50"
                    value={form.cost_per_1m_input_tokens || ""}
                    onChange={(e) => setForm({ ...form, cost_per_1m_input_tokens: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="output-cost">Cost per 1M Output Tokens ($)</Label>
                  <Input
                    id="output-cost"
                    type="number"
                    step="0.0001"
                    placeholder="1.50"
                    value={form.cost_per_1m_output_tokens || ""}
                    onChange={(e) => setForm({ ...form, cost_per_1m_output_tokens: parseFloat(e.target.value) || 0 })}
                  />
                </div>
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
