"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { agents, llm } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check, ArrowLeft, ArrowRight } from "lucide-react";

const STEPS = ["Basics", "Model & behavior", "Review"];

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [models, setModels] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    system_prompt: "คุณคือผู้ช่วยขององค์กร ตอบเป็นภาษาไทยอย่างสุภาพและกระชับ",
    model_id: 0,
    temperature: 0.7,
    max_tokens: 2048,
    is_published: false,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { llm.models().then(setModels).catch(() => {}); }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const a = await agents.create(form);
      router.push(`/chat/${a.id}`);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const canNext = (step === 1 && form.name.trim()) || (step === 2 && form.model_id) || step === 3;

  return (
    <AppShell>
      <Topbar title="Create agent" subtitle={STEPS[step - 1]}
              right={<Button variant="ghost" size="sm" onClick={() => router.back()}>Cancel</Button>} />

      <div className="px-6 py-8 max-w-2xl mx-auto">
        <header className="mb-7">
          <h1 className="font-serif text-3xl text-foreground tracking-tight">Create a new agent</h1>
          <p className="text-[13px] text-muted-foreground mt-1">ตั้งค่า AI Agent ของคุณใน {STEPS.length} ขั้นตอน</p>
        </header>

        <ol className="flex items-center mb-7">
          {STEPS.map((label, i) => {
            const n = i + 1; const active = step === n; const done = step > n;
            return (
              <li key={label} className="flex-1 flex items-center">
                <div className={`flex items-center gap-2 ${active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground"}`}>
                  <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold border
                    ${active ? "bg-primary text-primary-foreground border-primary"
                            : done ? "bg-accent text-accent-foreground border-accent"
                                   : "bg-card border-border"}`}>
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
                  <Label>Agent name <span className="text-primary">*</span></Label>
                  <Input placeholder="เช่น HR Helper" value={form.name}
                         onChange={(e) => set("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea placeholder="อธิบายความสามารถของ Agent…"
                            value={form.description}
                            onChange={(e) => set("description", e.target.value)} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label>System prompt</Label>
                  <Textarea rows={6} className="font-mono text-[12.5px] leading-relaxed"
                            value={form.system_prompt}
                            onChange={(e) => set("system_prompt", e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Model <span className="text-primary">*</span></Label>
                    <Select value={String(form.model_id)} onValueChange={(v) => set("model_id", Number(v))}>
                      <SelectTrigger><SelectValue placeholder="— Select —" /></SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.display_name || m.model_id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {models.length === 0 && (
                      <Alert variant="warning"><AlertDescription>ยังไม่มีโมเดล — ไปเพิ่มที่ Library → Models</AlertDescription></Alert>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max tokens</Label>
                    <Input type="number" min={64} max={32000}
                           value={form.max_tokens}
                           onChange={(e) => set("max_tokens", Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Temperature</Label>
                    <span className="font-mono text-[12px] text-primary">{form.temperature.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05}
                         value={form.temperature}
                         onChange={(e) => set("temperature", Number(e.target.value))}
                         className="w-full accent-primary" />
                  <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1">
                    <span>precise</span><span>balanced</span><span>creative</span>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <label className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/40 cursor-pointer">
                  <input type="checkbox" checked={form.is_published}
                         onChange={(e) => set("is_published", e.target.checked)}
                         className="mt-0.5 accent-primary w-4 h-4" />
                  <div>
                    <div className="text-[13px] font-medium">Publish to organization</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">หากปิด เฉพาะคุณและผู้ที่ได้รับสิทธิ์เท่านั้นที่เห็น</div>
                  </div>
                </label>

                <div>
                  <Label className="mb-2 block">Review</Label>
                  <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                    <Row k="Name" v={form.name || "—"} />
                    <Row k="Description" v={form.description || "—"} />
                    <Row k="Model" v={models.find((m) => m.id === form.model_id)?.display_name || "—"} />
                    <Row k="Temperature" v={form.temperature.toFixed(2)} />
                    <Row k="Max tokens" v={String(form.max_tokens)} />
                    <Row k="Visibility" v={form.is_published ? "published" : "private"} />
                  </div>
                </div>
              </div>
            )}

            {err && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
              <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              {step < 3 ? (
                <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button disabled={busy || !form.name || !form.model_id} onClick={submit}>
                  {busy ? "Creating…" : "Create agent"}
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
