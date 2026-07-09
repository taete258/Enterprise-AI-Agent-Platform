"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { agents, llm, admin } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Topbar, Button, Input, Label, Textarea, Card, CardContent, Alert, AlertDescription, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@taete258/ds";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = Number(params.agentId);
  const t = useTranslations("EditAgentPage");
  const STEPS = [t("basics"), t("modelBehavior"), t("skillsTools"), t("review")];

  const [step, setStep] = useState(1);
  const [models, setModels] = useState<any[]>([]);
  const [allTools, setAllTools] = useState<any[]>([]);
  const [selectedTools, setSelectedTools] = useState<Record<string, { enabled: boolean; config: string }>>({});
  const [originalTools, setOriginalTools] = useState<Record<string, { enabled: boolean; config: string }>>({});
  const [form, setForm] = useState({
    name: "",
    description: "",
    system_prompt: "",
    model_id: 0,
    temperature: 0.7,
    max_tokens: 2048,
    is_published: false,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      agents.get(agentId),
      llm.models(),
      admin.listTools(),
      agents.listTools(agentId),
    ])
      .then(([agent, modelList, toolList, agentTools]) => {
        setForm({
          name: agent.name,
          description: agent.description,
          system_prompt: agent.system_prompt,
          model_id: agent.model_id,
          temperature: agent.temperature,
          max_tokens: agent.max_tokens,
          is_published: agent.is_published,
        });
        setModels(modelList);
        setAllTools(toolList);

        // Build tools map
        const toolsMap: Record<string, { enabled: boolean; config: string }> = {};
        for (const tool of agentTools) {
          toolsMap[tool.tool_key] = { enabled: tool.enabled, config: tool.config };
        }
        setSelectedTools(toolsMap);
        setOriginalTools(toolsMap);
        setLoading(false);
      })
      .catch((e) => {
        setErr(e.message);
        setLoading(false);
      });
  }, [agentId]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      // Update agent details
      await agents.update(agentId, form);

      // Update tools
      const toolPayload = Object.entries(selectedTools).map(([key, t]) => ({
        tool_key: key,
        enabled: t.enabled,
        config: t.config || "{}",
      }));
      await agents.updateTools(agentId, toolPayload);

      router.push(`/agents/${agentId}` as any);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canNext = (step === 1 && form.name.trim()) || (step === 2 && form.model_id) || step === 3 || step === 4;

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-[13px]">
          Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Topbar
        title={t("title")}
        subtitle={STEPS[step - 1]}
        right={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            {t("cancel") ?? "Cancel"}
          </Button>
        }
      />

      <div className="px-6 py-8 max-w-2xl mx-auto">
        <header className="mb-7">
          <h1 className="font-serif text-3xl text-foreground tracking-tight">{t("title")}</h1>
          <p className="text-[13px] text-muted-foreground mt-1">{t("subtitle", { count: STEPS.length })}</p>
        </header>

        <ol className="flex items-center mb-7">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li key={label} className="flex-1 flex items-center">
                <div
                  className={`flex items-center gap-2 ${active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground"}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold border
                    ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : done
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-card border-border"
                    }`}
                  >
                    {done ? <Check className="size-3" /> : n}
                  </span>
                  <span className="text-[12px] font-medium hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${done ? "bg-primary/40" : "bg-border"}`} />}
              </li>
            );
          })}
        </ol>

        <Card>
          <CardContent className="pt-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>
                    {t("agentName")} <span className="text-primary">*</span>
                  </Label>
                  <Input
                    placeholder={t("namePlaceholder")}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("description")}</Label>
                  <Textarea
                    placeholder={t("descPlaceholder")}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label>{t("systemPrompt")}</Label>
                  <Textarea
                    rows={6}
                    className="font-mono text-[12.5px] leading-relaxed"
                    value={form.system_prompt}
                    onChange={(e) => set("system_prompt", e.target.value)}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>
                      {t("model")} <span className="text-primary">*</span>
                    </Label>
                    <Select value={String(form.model_id)} onValueChange={(v) => set("model_id", Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.display_name || m.model_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {models.length === 0 && (
                      <Alert variant="warning">
                        <AlertDescription>{t("noModels")}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("maxTokens")}</Label>
                    <Input
                      type="number"
                      min={64}
                      max={32000}
                      value={form.max_tokens}
                      onChange={(e) => set("max_tokens", Number(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>{t("temperature")}</Label>
                    <span className="font-mono text-[12px] text-primary">{form.temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={form.temperature}
                    onChange={(e) => set("temperature", Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1">
                    <span>{t("precise")}</span>
                    <span>{t("balanced")}</span>
                    <span>{t("creative")}</span>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <Label className="text-[14px]">{t("selectTools")}</Label>
                <p className="text-[12px] text-muted-foreground">{t("toolsDesc")}</p>
                <div className="space-y-3">
                  {allTools.map((tool) => {
                    const isChecked = selectedTools[tool.key]?.enabled || false;
                    return (
                      <div key={tool.key} className="p-3.5 rounded-md border border-border bg-card">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedTools((prev) => ({
                                ...prev,
                                [tool.key]: {
                                  enabled: !prev[tool.key]?.enabled,
                                  config: prev[tool.key]?.config || "{}",
                                },
                              }));
                            }}
                            className="mt-0.5 w-4 h-4 accent-primary"
                          />
                          <div>
                            <div className="text-[13px] font-medium text-foreground flex items-center gap-2">
                              {tool.name}
                              <code className="text-[10px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded">
                                {tool.key}
                              </code>
                            </div>
                            <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                              {tool.description}
                            </div>
                          </div>
                        </label>
                        {isChecked && tool.type === "api" && (
                          <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5 pl-7">
                            <Label className="text-[11px] text-muted-foreground">{t("configOverride")}</Label>
                            <textarea
                              rows={2}
                              className="w-full font-mono text-[11px] bg-transparent border border-input rounded p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder='{ "headers": { "Authorization": "Bearer token" } }'
                              value={selectedTools[tool.key]?.config || "{}"}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedTools((prev) => ({
                                  ...prev,
                                  [tool.key]: { ...prev[tool.key], config: val },
                                }));
                              }}
                            />
                          </div>
                        )}
                        {isChecked && tool.key === "generate_image" && (
                          <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5 pl-7">
                            <Label className="text-[11px] text-muted-foreground">{t("imageGenModel")}</Label>
                            <Select
                              value={(() => {
                                try {
                                  const cfg = JSON.parse(selectedTools[tool.key]?.config || "{}");
                                  return String(cfg.model_db_id || "default");
                                } catch {
                                  return "default";
                                }
                              })()}
                              onValueChange={(val) => {
                                setSelectedTools((prev) => {
                                  try {
                                    const cfg = JSON.parse(prev[tool.key]?.config || "{}");
                                    if (val === "default") {
                                      delete cfg.model_db_id;
                                    } else {
                                      cfg.model_db_id = Number(val);
                                    }
                                    return {
                                      ...prev,
                                      [tool.key]: {
                                        ...prev[tool.key],
                                        config: JSON.stringify(cfg),
                                      },
                                    };
                                  } catch {
                                    return prev;
                                  }
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-[12px] bg-transparent">
                                <SelectValue placeholder="— Select Model —" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default" className="text-[12px]">
                                  {t("defaultFallback")}
                                </SelectItem>
                                {models
                                  .filter((m) => m.supports_image_generation)
                                  .map((m) => (
                                    <SelectItem key={m.id} value={String(m.id)} className="text-[12px]">
                                      {m.display_name || m.model_id}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {allTools.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-[12px]">{t("noSkills")}</div>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <label className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => set("is_published", e.target.checked)}
                    className="mt-0.5 accent-primary w-4 h-4"
                  />
                  <div>
                    <div className="text-[13px] font-medium">{t("publishOrg")}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{t("publishDesc")}</div>
                  </div>
                </label>

                <div>
                  <Label className="mb-2 block">{t("reviewDetails")}</Label>
                  <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                    <Row k="Name" v={form.name || "—"} />
                    <Row k="Description" v={form.description || "—"} />
                    <Row k="Model" v={models.find((m) => m.id === form.model_id)?.display_name || "—"} />
                    <Row k="Temperature" v={form.temperature.toFixed(2)} />
                    <Row k="Max tokens" v={String(form.max_tokens)} />
                    <Row k="Visibility" v={form.is_published ? "published" : "private"} />
                    <Row
                      k="Enabled Tools"
                      v={
                        Object.entries(selectedTools)
                          .filter(([_, t]) => t.enabled)
                          .map(([k]) => k)
                          .join(", ") || "none"
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {err && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="size-4" />
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
              <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
                <ArrowLeft className="size-4" /> {t("back")}
              </Button>
              {step < 4 ? (
                <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
                  {t("continue")} <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button disabled={busy || !form.name || !form.model_id} onClick={submit}>
                  {busy ? t("saving") : t("saveButton")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 px-4 py-2.5 text-[13px] bg-card">
      <div className="text-muted-foreground">{k}</div>
      <div className="col-span-2 text-foreground">{v}</div>
    </div>
  );
}
