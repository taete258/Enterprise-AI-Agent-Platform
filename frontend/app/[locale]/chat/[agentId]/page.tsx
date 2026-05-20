"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { agents, sessions, llm, auth, admin } from "@/lib/api";
import AppShell from "@/components/AppShell";
import Topbar from "@/components/Topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Send, Settings, BookOpen, ChevronRight, Paperclip, X, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Attachment = { name: string; size?: number; mime?: string; localUrl?: string };

function isImageAttachment(a: Attachment): boolean {
  if (a.mime && a.mime.startsWith("image/")) return true;
  const ext = (a.name || "").toLowerCase().split(".").pop() || "";
  return ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
}
type Msg = {
  id?: number;
  role: "user" | "assistant" | "tool";
  content: string;
  citations?: any[];
  tokens_in?: number;
  tokens_out?: number;
  tool_calls?: any;
  tool_call_id?: string;
  attachments?: Attachment[];
};

function parseAttachments(raw: any): Attachment[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map((a: any) => ({ name: a.name, size: a.size, mime: a.mime }));
  } catch { return []; }
}

function formatBytes(n?: number) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatSessionTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sessionDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const timeStr = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  if (sessionDate.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  } else if (sessionDate.getTime() === yesterday.getTime()) {
    return `Yesterday at ${timeStr}`;
  } else {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  }
}

function tryExtractImageUrl(content: string): string | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content);
    if (typeof data === "object" && data !== null) {
      const url = data.image_url || data.image || data.url || data.src;
      if (typeof url === "string" && (url.startsWith("http") || url.startsWith("data:"))) {
        return url;
      }
    }
  } catch {}
  const match = content.match(/(https?:\/\/[^\s"<>]+\.(?:png|jpg|jpeg|gif|webp))/i);
  if (match) return match[1];
  return null;
}

export default function ChatPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const id = Number(agentId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("ChatPage");
  const sessionIdQuery = searchParams ? searchParams.get("session_id") : null;

  const [agent, setAgent] = useState<any>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [ags, setAgs] = useState<Record<number, any>>({});
  const [models, setModels] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelErr, setModelErr] = useState("");
  const [allTools, setAllTools] = useState<any[]>([]);
  const [agentTools, setAgentTools] = useState<any[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { agents.get(id).then(setAgent).catch(() => {}); }, [id]);
  useEffect(() => { llm.models().then(setModels).catch(() => {}); }, []);
  useEffect(() => { auth.me().then(setUser).catch(() => {}); }, []);

  async function loadTools() {
    try {
      const all = await admin.listTools();
      setAllTools(all);
      const bound = await agents.listTools(id);
      setAgentTools(bound);
    } catch (e) {}
  }
  useEffect(() => { loadTools(); }, [id]);

  const canEdit = !!(user && agent && (user.is_superuser || agent.owner_id === user.id));

  async function handleModelChange(value: string) {
    const modelId = Number(value);
    setModelBusy(true);
    setModelErr("");
    try {
      await agents.update(id, { model_id: modelId });
      setAgent((prev: any) => prev ? { ...prev, model_id: modelId } : null);
    } catch (e: any) {
      setModelErr(e.message || "Failed to update model");
    } finally {
      setModelBusy(false);
    }
  }

  async function toggleTool(toolKey: string, currentEnabled: boolean) {
    if (!canEdit) return;
    const updated = allTools.map((t) => {
      const existing = agentTools.find((at) => at.tool_key === t.key);
      const wasEnabled = existing ? existing.enabled : false;
      const nextEnabled = t.key === toolKey ? !currentEnabled : wasEnabled;
      return { tool_key: t.key, enabled: nextEnabled, config: existing?.config || "{}" };
    });
    try {
      await agents.updateTools(id, updated);
      const bound = await agents.listTools(id);
      setAgentTools(bound);
    } catch (e: any) {
      alert("Failed to update tools: " + e.message);
    }
  }

  useEffect(() => {
    agents.list().then((rows) => {
      const map: Record<number, any> = {};
      rows.forEach((a) => (map[a.id] = a));
      setAgs(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    sessions.list().then(setSessionsList).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (sessionIdQuery) {
      const sId = Number(sessionIdQuery);
      setSessionId(sId);
      sessions.messages(sId)
        .then((data) => {
          setMsgs(data.map((m: any) => ({
            id: m.id,
            role: m.role, content: m.content, citations: m.citations,
            tokens_in: m.tokens_in, tokens_out: m.tokens_out,
            tool_calls: m.tool_calls, tool_call_id: m.tool_call_id,
            attachments: parseAttachments(m.attachments),
          })));
        }).catch(() => {});
    } else {
      const isNew = searchParams ? searchParams.get("new") === "true" : false;
      if (!isNew && sessionsList.length > 0) {
        const existingSession = sessionsList.find((s) => s.agent_id === id);
        if (existingSession) {
          router.replace(`/chat/${id}?session_id=${existingSession.id}` as any);
          return;
        }
      }
      setSessionId(undefined);
      setMsgs([]);
    }
  }, [id, sessionIdQuery, sessionsList, searchParams, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  function autosize() {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }

  async function send() {
    const text = input.trim();
    const files = pendingFiles;
    if ((!text && files.length === 0) || busy) return;
    setInput(""); autosize();
    const optimisticAttachments: Attachment[] = files.map((f) => ({
      name: f.name, size: f.size, mime: f.type,
      localUrl: URL.createObjectURL(f),
    }));
    setMsgs((m) => [...m, { role: "user", content: text, attachments: optimisticAttachments }]);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBusy(true);
    try {
      const r = await agents.chat({ session_id: sessionId, agent_id: id, message: text, files });
      setSessionId(r.session_id);
      const freshData = await sessions.messages(r.session_id);
      setMsgs(freshData.map((m: any) => ({
        id: m.id,
        role: m.role, content: m.content, citations: m.citations,
        tokens_in: m.tokens_in, tokens_out: m.tokens_out,
        tool_calls: m.tool_calls, tool_call_id: m.tool_call_id,
        attachments: parseAttachments(m.attachments),
      })));
      if (!sessionId) {
        router.replace(`/chat/${id}?session_id=${r.session_id}` as any);
      }
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠ ${e.message}` }]);
    } finally { setBusy(false); }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const totalIn  = msgs.reduce((s, m) => s + (m.tokens_in  || 0), 0);
  const totalOut = msgs.reduce((s, m) => s + (m.tokens_out || 0), 0);

  return (
    <AppShell
      rightPanel={
        <Inspector
          agent={agent}
          totalIn={totalIn}
          totalOut={totalOut}
          msgCount={msgs.length}
          models={models}
          canEdit={canEdit}
          modelBusy={modelBusy}
          handleModelChange={handleModelChange}
          modelErr={modelErr}
          allTools={allTools}
          agentTools={agentTools}
          toggleTool={toggleTool}
        />
      }
    >
      <div className="flex h-full min-w-0 overflow-hidden">
        {/* Left pane: Chat History */}
        <aside className="w-64 border-r border-border bg-sidebar/35 flex flex-col shrink-0 min-w-0">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="font-serif text-[15px] font-semibold text-sidebar-foreground tracking-tight">{t("recentChats")}</h2>
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-7 px-2.5"
              onClick={() => router.push(`/chat/${id}?new=true` as any)}
            >
              {t("newChat")}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessionsList.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground p-3 text-center">{t("noHistory")}</p>
            ) : (
              sessionsList.map((s) => {
                const active = sessionId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/chat/${s.agent_id}?session_id=${s.id}` as any)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors flex flex-col gap-0.5 ${
                      active
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    }`}
                  >
                    <span className="text-[12.5px] truncate block text-foreground font-medium">{s.title}</span>
                    <span className="text-[9.5px] text-muted-foreground block truncate">
                      {ags[s.agent_id]?.name || "Agent"} · {formatSessionTime(s.created_at)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right pane: Chat Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <Topbar
            title={
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-accent text-accent-foreground grid place-items-center font-serif text-[11px]">
                  {agent?.name?.[0]?.toUpperCase() || "A"}
                </span>
                <span className="font-medium">{agent?.name ?? "Agent"}</span>
              </span>
            }
            subtitle={
              <span className="flex items-center gap-2 mt-0.5">
                <span className="truncate max-w-[280px]">{agent?.description}</span>
                {agent && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
                    {models.find((m) => m.id === agent.model_id)?.display_name || `Model #${agent.model_id}`}
                  </span>
                )}
              </span>
            }
            right={<span className="font-mono text-[10.5px] text-muted-foreground">{sessionId ? t("sessionLabel", { id: sessionId }) : t("newChatLabel")}</span>}
          />

          <div className="flex-1 flex flex-col min-h-0">
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-8">
                {msgs.length === 0 ? (
                  <Welcome name={agent?.name} />
                ) : (
                  <div className="divide-y divide-border/60">
                    {msgs.map((m, i) => (
                      <div key={i} className={`py-6 ${i === 0 ? "pt-0" : ""} ${i === msgs.length - 1 && !busy ? "pb-0" : ""}`}>
                        <Bubble msg={m} />
                      </div>
                    ))}
                    {busy && (
                      <div className="py-6 pb-0">
                        <TypingBubble />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border bg-sidebar/60 backdrop-blur shrink-0">
              <div className="max-w-3xl mx-auto px-6 py-3.5">
                <Card className="p-1.5 flex flex-col gap-1.5">
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-2 pt-1">
                      {pendingFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11.5px] bg-muted border border-border rounded-md pl-2 pr-1 py-1 max-w-[220px]">
                          <FileText className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate" title={f.name}>{f.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{formatBytes(f.size)}</span>
                          <button
                            type="button"
                            className="ml-0.5 p-0.5 rounded hover:bg-accent shrink-0"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            aria-label={t("removeAttachment")}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const fl = Array.from(e.target.files || []);
                        if (fl.length) setPendingFiles((prev) => [...prev, ...fl]);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy}
                      aria-label={t("attachFile")}
                    >
                      <Paperclip className="size-4" />
                    </Button>
                    <textarea
                      ref={taRef}
                      rows={1}
                      className="flex-1 resize-none bg-transparent outline-none px-3 py-2 text-[14px] placeholder:text-muted-foreground max-h-[220px]"
                      placeholder={t("inputPlaceholder")}
                      value={input}
                      onChange={(e) => { setInput(e.target.value); autosize(); }}
                      onKeyDown={onKey}
                    />
                    <Button onClick={send} disabled={busy || (!input.trim() && pendingFiles.length === 0)} size="icon">
                      <Send className="size-4" />
                    </Button>
                  </div>
                </Card>
                <div className="flex items-center justify-between mt-2 text-[10.5px] text-muted-foreground px-1">
                  <div className="flex items-center gap-2">
                    <span>{t("shortcuts")}</span>
                    {agent && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <div className="flex items-center gap-1">
                          <span>{t("modelLabel")}</span>
                          <Select value={String(agent.model_id)} onValueChange={handleModelChange} disabled={modelBusy || !canEdit}>
                            <SelectTrigger className="h-6 text-[10px] px-1.5 py-0 bg-background border border-border rounded-md hover:bg-accent font-mono focus:ring-0">
                              <SelectValue placeholder={t("selectModel")} />
                            </SelectTrigger>
                            <SelectContent>
                              {models.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)} className="text-[10.5px]">
                                  {m.display_name || m.model_id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {modelErr && (
                            <span className="text-[9px] text-destructive ml-1">{modelErr}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <span className="font-mono">↑ {totalIn} · ↓ {totalOut}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Welcome({ name }: { name?: string }) {
  const t = useTranslations("ChatPage");
  return (
    <div className="text-center pt-10">
      <h2 className="font-serif text-3xl text-foreground tracking-tight">{t("greeting", { name: name || "Agent" })}</h2>
      <p className="text-[14px] text-muted-foreground mt-2">{t("intro")}</p>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const t = useTranslations("ChatPage");
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";

  if (isTool) {
    const imageUrl = tryExtractImageUrl(msg.content);
    return (
      <div className="flex gap-4 items-center pl-11 py-1">
        <div className="w-5 h-5 rounded bg-muted border border-border flex items-center justify-center text-[10px] text-muted-foreground shrink-0 font-mono">
          T
        </div>
        <details className="flex-1 min-w-0 group" open={!!imageUrl}>
          <summary className="text-[11.5px] font-medium text-muted-foreground cursor-pointer hover:underline select-none">
            {t("toolOutput")} (ID: {msg.tool_call_id?.slice(0, 8) || "call"})
          </summary>
          <div className="mt-1.5 space-y-2">
            {imageUrl && (
              <img src={imageUrl} alt="Tool output" className="rounded-md border border-border max-w-[320px] max-h-[320px]" />
            )}
            <pre className="p-3 rounded-md bg-muted border border-border text-[11px] font-mono text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
              {msg.content}
            </pre>
          </div>
        </details>
      </div>
    );
  }

  let parsedTools: any[] = [];
  if (msg.tool_calls) {
    try {
      parsedTools = typeof msg.tool_calls === "string" ? JSON.parse(msg.tool_calls) : msg.tool_calls;
    } catch (e) {}
  }

  return (
    <div className={`flex gap-4 group ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-md grid place-items-center text-[11px] font-semibold shrink-0 mt-1
        ${isUser ? "bg-foreground text-background" : "bg-accent text-accent-foreground font-serif"}`}>
        {isUser ? "U" : "A"}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {msg.attachments && msg.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 max-w-[85%] ${isUser ? "ml-auto justify-end" : "mr-auto"}`}>
            {msg.attachments.map((a, idx) => (
              <AttachmentItem key={idx} messageId={msg.id} attachment={a} />
            ))}
          </div>
        )}
        {msg.content && (
          <div className={`text-[14px] leading-relaxed whitespace-pre-wrap px-4 py-2.5 shadow-sm max-w-[85%] w-fit
            ${isUser
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none ml-auto text-left"
              : "bg-card text-foreground border border-border/80 rounded-2xl rounded-tl-none mr-auto text-left"}`}>
            {msg.content}
          </div>
        )}
        {parsedTools && parsedTools.length > 0 && (
          <div className="space-y-1.5 mr-auto max-w-[85%]">
            {parsedTools.map((tc: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-[12px] bg-muted/65 border border-border/80 px-3 py-1.5 rounded-lg text-muted-foreground font-mono">
                <span className="animate-pulse size-1.5 rounded-full bg-primary" />
                <span>{t("calling")} <strong className="text-foreground">{tc.function?.name}</strong>({tc.function?.arguments})</span>
              </div>
            ))}
          </div>
        )}
        {msg.citations && msg.citations.length > 0 && (
          <div className={`mt-2.5 flex flex-wrap gap-1.5 ${isUser ? "justify-end" : ""}`}>
            {msg.citations.map((c, idx) => (
              <Badge key={idx} variant="success" className="font-mono normal-case" title={c.snippet}>
                Doc#{c.document_id} · {(c.score * 100).toFixed(0)}%
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentItem({ messageId, attachment }: { messageId?: number; attachment: Attachment }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const isImage = isImageAttachment(attachment);

  useEffect(() => {
    let revoke: string | null = null;
    let aborted = false;
    if (attachment.localUrl) {
      setBlobUrl(attachment.localUrl);
      return;
    }
    if (!messageId) return;
    (async () => {
      try {
        const url = agents.attachmentUrl(messageId, attachment.name);
        const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const res = await fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        revoke = obj;
        if (!aborted) setBlobUrl(obj);
      } catch {
        if (!aborted) setErrored(true);
      }
    })();
    return () => {
      aborted = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [messageId, attachment.name, attachment.localUrl]);

  if (isImage) {
    return (
      <div className="rounded-lg overflow-hidden border border-border/80 bg-muted max-w-[260px]">
        {blobUrl ? (
          <a href={blobUrl} target="_blank" rel="noreferrer">
            <img src={blobUrl} alt={attachment.name} className="block max-h-[260px] w-auto" />
          </a>
        ) : (
          <div className="flex items-center gap-1.5 text-[12px] px-2 py-1.5">
            <FileText className="size-3 text-muted-foreground" />
            <span className="truncate">{errored ? `⚠ ${attachment.name}` : attachment.name}</span>
          </div>
        )}
      </div>
    );
  }

  const chip = (
    <span className="flex items-center gap-1.5 text-[12px] bg-muted/70 border border-border/80 rounded-md px-2 py-1 max-w-[220px]">
      <FileText className="size-3 text-muted-foreground shrink-0" />
      <span className="truncate" title={attachment.name}>{attachment.name}</span>
      {attachment.size != null && (
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{formatBytes(attachment.size)}</span>
      )}
    </span>
  );
  return blobUrl ? (
    <a href={blobUrl} download={attachment.name} className="hover:opacity-80">{chip}</a>
  ) : (
    chip
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-md bg-accent text-accent-foreground grid place-items-center text-[11px] font-serif font-semibold shrink-0 mt-1">A</div>
      <div className="bg-card text-foreground border border-border/80 rounded-2xl rounded-tl-none px-4 py-3.5 shadow-sm mr-auto w-fit flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-blink" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-blink" style={{ animationDelay: ".15s" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-blink" style={{ animationDelay: ".3s" }} />
      </div>
    </div>
  );
}

function Inspector({
  agent, totalIn, totalOut, msgCount, models, canEdit, modelBusy, handleModelChange, modelErr,
  allTools, agentTools, toggleTool
}: {
  agent: any; totalIn: number; totalOut: number; msgCount: number;
  models: any[]; canEdit: boolean; modelBusy: boolean; handleModelChange: (val: string) => void;
  modelErr: string;
  allTools: any[]; agentTools: any[]; toggleTool: (key: string, enabled: boolean) => Promise<void>;
}) {
  const t = useTranslations("ChatPage");
  if (!agent) return <div className="p-5 text-[11px] text-muted-foreground">Loading…</div>;
  const currentModel = models.find((m) => m.id === agent.model_id);
  const currentModelName = currentModel ? (currentModel.display_name || currentModel.model_id) : `Model #${agent.model_id}`;

  return (
    <div className="p-5 space-y-6 max-h-screen overflow-y-auto pb-10">
      <div>
        <div className="section-h mb-2">Agent</div>
        <div className="font-serif text-[17px] text-foreground tracking-tight">{agent.name}</div>
        <p className="text-[12px] text-muted-foreground mt-1">{agent.description || t("noDescription")}</p>
      </div>

      <Separator />

      <div className="space-y-2.5">
        <div className="section-h">{t("parameters")}</div>
        <Row k="Temperature" v={agent.temperature.toFixed(2)} />
        <Row k="Max tokens" v={String(agent.max_tokens)} />

        <div className="flex items-center justify-between text-[12px] min-h-[28px]">
          <span className="text-muted-foreground">Model</span>
          {canEdit ? (
            <div className="flex flex-col items-end">
              <Select value={String(agent.model_id)} onValueChange={handleModelChange} disabled={modelBusy}>
                <SelectTrigger className="h-7 text-[11px] px-2 py-1 bg-background border-border min-w-[125px] max-w-[170px]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)} className="text-[11px]">
                      {m.display_name || m.model_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelErr && (
                <span className="text-[9px] text-destructive mt-0.5 font-sans leading-none">{modelErr}</span>
              )}
            </div>
          ) : (
            <span className="font-mono text-foreground">{currentModelName}</span>
          )}
        </div>

        <Row k="Visibility" v={agent.is_published ? "published" : "private"} />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="section-h">{t("enabledSkills")}</div>
        <div className="space-y-2">
          {allTools.map((tool) => {
            const bound = agentTools.find((at) => at.tool_key === tool.key);
            const enabled = bound ? bound.enabled : false;
            return (
              <label key={tool.key} className="flex items-start gap-2.5 p-2 rounded-lg border border-border/80 bg-card hover:bg-accent/40 cursor-pointer text-[12.5px] transition-colors">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!canEdit}
                  onChange={() => toggleTool(tool.key, enabled)}
                  className="mt-0.5 w-3.5 h-3.5 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground flex items-center justify-between">
                    <span>{tool.name}</span>
                    {tool.type === "system" ? (
                      <span className="text-[8.5px] text-muted-foreground font-mono bg-muted px-1 rounded">sys</span>
                    ) : (
                      <span className="text-[8.5px] text-primary font-mono bg-primary/10 px-1 rounded">api</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate" title={tool.description}>{tool.description}</p>
                </div>
              </label>
            );
          })}
          {allTools.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-2">{t("noTools")}</p>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <div className="section-h mb-2">{t("systemPrompt")}</div>
        <div className="text-[12px] font-mono leading-relaxed text-foreground/80 bg-muted border border-border rounded-md p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
          {agent.system_prompt || "—"}
        </div>
      </div>

      <Separator />

      <div className="space-y-2.5">
        <div className="section-h">{t("sessionStats")}</div>
        <Row k={t("messages")} v={String(msgCount)} />
        <Row k={t("tokensIn")} v={totalIn.toLocaleString()} />
        <Row k={t("tokensOut")} v={totalOut.toLocaleString()} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-foreground">{v}</span>
    </div>
  );
}
