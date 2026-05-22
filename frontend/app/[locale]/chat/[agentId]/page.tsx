"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { Send, Settings, BookOpen, ChevronRight, Paperclip, X, FileText, ChevronLeft, Pin, Edit2, Trash2, MoreVertical, Link2Off, Loader2, ArrowDown, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Attachment = { name: string; size?: number; mime?: string; localUrl?: string };

function isImageAttachment(a: Attachment): boolean {
  if (a.mime && a.mime.startsWith("image/")) return true;
  const ext = (a.name || "").toLowerCase().split(".").pop() || "";
  return ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
}

function getGroupBgColor(groupId: number): string {
  const colors = [
    "bg-red-50",
    "bg-blue-50",
    "bg-green-50",
    "bg-yellow-50",
    "bg-purple-50",
    "bg-pink-50",
    "bg-indigo-50",
    "bg-cyan-50",
    "bg-orange-50",
    "bg-lime-50",
  ];
  return colors[groupId % colors.length];
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
      if (Array.isArray(data.images) && data.images.length > 0) {
        const first = data.images[0];
        if (typeof first === "string") return first;
        if (first && typeof first === "object") {
          const url = first.url || first.image_url || first.src;
          if (typeof url === "string") return url;
        }
      }
      const url = data.image_url || data.image || data.url || data.src;
      if (typeof url === "string" && (url.startsWith("http") || url.startsWith("data:"))) {
        return url;
      }
    }
  } catch { }
  // Match a URL with .png/.jpg/etc. and an optional query string (presigned URLs)
  const match = content.match(/(https?:\/\/[^\s"<>]+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s"<>]*)?)/i);
  if (match) return match[1];
  return null;
}

function parseImageGenerationJson(content: string): { model?: string; prompt?: string; images: Array<{ url: string }> } | null {
  try {
    const data = JSON.parse(content);
    if (data.images && Array.isArray(data.images)) {
      return data;
    }
  } catch { }

  // Try to extract JSON from code blocks or other text
  try {
    const jsonMatch = content.match(/\{[\s\S]*"images"[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.images && Array.isArray(data.images)) {
        return data;
      }
    }
  } catch { }

  return null;
}

function renderContentWithImages(content: string, modelName: string | null = null): ReactNode[] {
  if (!content) return [];

  // Check if this is an image generation response
  const imgGenData = parseImageGenerationJson(content);
  if (imgGenData && imgGenData.images.length > 0) {
    const parts: ReactNode[] = [];
    imgGenData.images.forEach((img, idx) => {
      if (img.url) {
        parts.push(
          <div key={`img-gen-${idx}`} className="flex flex-col gap-1">
            <a href={img.url} target="_blank" rel="noopener noreferrer">
              <img src={img.url} alt={`Generated image ${idx + 1}`} className="rounded-md border border-border max-w-full max-h-[480px]" />
            </a>
            {(imgGenData.model || modelName) && (
              <span className="text-[11px] text-muted-foreground font-mono">Model: {imgGenData.model || modelName}</span>
            )}
          </div>
        );
      }
    });
    return parts;
  }

  const parts: ReactNode[] = [];
  // Match markdown image: ![alt](url)  — url may contain `?` and `&`
  const re = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={`t-${key++}`}>{content.slice(lastIndex, m.index)}</span>);
    }
    const imgAlt = m[1] || "image";
    const imgUrl = m[2];
    parts.push(
      <div key={`img-${key++}`} className="flex flex-col gap-1">
        <a href={imgUrl} target="_blank" rel="noopener noreferrer">
          <img src={imgUrl} alt={imgAlt} className="rounded-md border border-border max-w-full max-h-[480px] my-2" />
        </a>
        {modelName && (
          <span className="text-[11px] text-muted-foreground font-mono">Model: {modelName}</span>
        )}
      </div>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<span key={`t-${key++}`}>{content.slice(lastIndex)}</span>);
  }
  return parts;
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
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  const [groups, setGroups] = useState<any[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [renameTarget, setRenameTarget] = useState<any | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [actionError, setActionError] = useState("");
  const [draggedSession, setDraggedSession] = useState<any | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<any | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // 'hidden' | 'entering' | 'exiting'
  const [spinnerPhase, setSpinnerPhase] = useState<'hidden' | 'entering' | 'exiting'>('hidden');
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Zone height management for resizable sidebar
  const [pinnedHeight, setPinnedHeight] = useState<number | null>(null);
  const [groupsHeight, setGroupsHeight] = useState<number | null>(null);
  const resizeRef = useRef<{ isResizing: boolean; startY: number; startPinnedH: number; startGroupsH: number; sidebarHeight: number }>({
    isResizing: false,
    startY: 0,
    startPinnedH: 0,
    startGroupsH: 0,
    sidebarHeight: 0,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  const msgsRef = useRef<Msg[]>([]);
  const loadSessionIdRef = useRef<number | undefined>(undefined);
  const lastMsgCountRef = useRef(0);

  useEffect(() => { agents.get(id).then(setAgent).catch(() => { }); }, [id]);
  useEffect(() => { llm.models().then(setModels).catch(() => { }); }, []);
  useEffect(() => { auth.me().then(setUser).catch(() => { }); }, []);

  async function loadTools() {
    try {
      const all = await admin.listTools();
      setAllTools(all);
      const bound = await agents.listTools(id);
      setAgentTools(bound);
    } catch (e) { }
  }
  useEffect(() => { loadTools(); }, [id]);

  // Initialize zone heights from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('chatSidebarZoneHeights');
    if (saved) {
      try {
        const { pinned, groups } = JSON.parse(saved);
        setPinnedHeight(pinned);
        setGroupsHeight(groups);
      } catch { }
    }
  }, []);

  // Save zone heights to localStorage
  const saveHeights = (pHeight: number, gHeight: number) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('chatSidebarZoneHeights', JSON.stringify({ pinned: pHeight, groups: gHeight }));
  };

  const handleResizeStart = (resizeType: 'pinned-groups' | 'groups-ungrouped') => (e: React.MouseEvent) => {
    const sidebar = document.querySelector('aside');
    if (!sidebar) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const headerHeight = 60;
    const availHeight = sidebarRect.height - headerHeight;

    const startPinnedH = pinnedHeight || Math.floor(availHeight * 0.25);
    const startGroupsH = groupsHeight || Math.floor(availHeight * 0.5);

    resizeRef.current.isResizing = true;
    resizeRef.current.startY = e.clientY;
    resizeRef.current.sidebarHeight = availHeight;
    resizeRef.current.startPinnedH = startPinnedH;
    resizeRef.current.startGroupsH = startGroupsH;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current.isResizing) return;
      const delta = moveEvent.clientY - resizeRef.current.startY;
      const minHeight = 60;

      if (resizeType === 'pinned-groups') {
        const newPinnedH = Math.max(minHeight, resizeRef.current.startPinnedH + delta);
        const newGroupsH = Math.max(minHeight, resizeRef.current.sidebarHeight - newPinnedH - minHeight);
        setPinnedHeight(newPinnedH);
        setGroupsHeight(newGroupsH);
      } else {
        const delta = moveEvent.clientY - resizeRef.current.startY;
        const newGroupsH = Math.max(minHeight, resizeRef.current.startGroupsH + delta);
        setGroupsHeight(newGroupsH);
      }
    };

    const handleMouseUp = () => {
      resizeRef.current.isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (pinnedHeight && groupsHeight) {
        saveHeights(pinnedHeight, groupsHeight);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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

  async function handleRenameSession() {
    if (!renameTarget || !renameTitle.trim()) return;
    try {
      await sessions.update(renameTarget.id, { title: renameTitle });
      setSessionsList((prev) =>
        prev.map((s) => (s.id === renameTarget.id ? { ...s, title: renameTitle } : s))
      );
      setRenameTarget(null);
    } catch (e: any) {
      setActionError(e.message);
    }
  }

  async function handleTogglePin(sessionId: number, pinned: boolean) {
    try {
      const session = sessionsList.find(s => s.id === sessionId);
      const updateData: any = { is_pinned: pinned };
      if (pinned && session?.group_id) {
        updateData.group_id = null;
      }
      await sessions.update(sessionId, updateData);
      setSessionsList((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updateData } : s))
      );
    } catch (e: any) {
      setActionError(e.message);
    }
  }

  async function handleDeleteSession() {
    if (!deleteTarget) return;
    try {
      await sessions.update(deleteTarget.id, { is_archived: true });
      setSessionsList((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      if (sessionId === deleteTarget.id) {
        const nextSession = sessionsList.find((s) => s.id !== deleteTarget.id);
        if (nextSession) {
          router.push(`/chat/${nextSession.agent_id}?session_id=${nextSession.id}` as any);
        } else {
          router.push(`/agents`);
        }
      }
      setDeleteTarget(null);
    } catch (e: any) {
      setActionError(e.message);
    }
  }

  async function createNewGroup() {
    if (!newGroupName.trim()) return;
    try {
      const newGroup = await sessions.createGroup(newGroupName);
      setGroups([...groups, newGroup]);
      setNewGroupName("");
      setShowNewGroupDialog(false);
    } catch (e: any) {
      setActionError(e.message);
    }
  }

  function handleSessionDragStart(session: any) {
    return (e: React.DragEvent) => {
      setDraggedSession(session);
      e.dataTransfer.effectAllowed = "move";
    };
  }

  function handleGroupDrop(groupId: number) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedSession) return;
      sessions.update(draggedSession.id, { group_id: groupId }).then(() => {
        setSessionsList((prev) =>
          prev.map((s) =>
            s.id === draggedSession.id ? { ...s, group_id: groupId } : s
          )
        );
        setDraggedSession(null);
      }).catch((err: any) => {
        setActionError(err.message);
      });
    };
  }

  function handleUngroupDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSession) return;
    sessions.update(draggedSession.id, { group_id: null }).then(() => {
      setSessionsList((prev) =>
        prev.map((s) =>
          s.id === draggedSession.id ? { ...s, group_id: null } : s
        )
      );
      setDraggedSession(null);
    }).catch((err: any) => {
      setActionError(err.message);
    });
  }

  async function handleDeleteGroup() {
    if (!groupToDelete) return;
    try {
      await sessions.updateGroup(groupToDelete.id, { delete: true });
      setGroups((prev) => prev.filter(g => g.id !== groupToDelete.id));
      setSessionsList((prev) =>
        prev.map((s) =>
          s.group_id === groupToDelete.id ? { ...s, group_id: null } : s
        )
      );
      setGroupToDelete(null);
    } catch (e: any) {
      setActionError(e.message);
    }
  }

  useEffect(() => {
    agents.list().then((rows) => {
      const map: Record<number, any> = {};
      rows.forEach((a) => (map[a.id] = a));
      setAgs(map);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    sessions.list().then(setSessionsList).catch(() => { });
  }, [sessionId]);

  useEffect(() => {
    sessions.listGroups().then(setGroups).catch(() => { });
  }, []);

  useEffect(() => {
    if (renameTarget) {
      setRenameTitle(renameTarget.title);
    }
  }, [renameTarget]);

  const PAGE_SIZE = 50;

  function mapMsg(m: any): Msg {
    return {
      id: m.id,
      role: m.role, content: m.content, citations: m.citations,
      tokens_in: m.tokens_in, tokens_out: m.tokens_out,
      tool_calls: m.tool_calls, tool_call_id: m.tool_call_id,
      attachments: parseAttachments(m.attachments),
    };
  }

  useEffect(() => {
    if (sessionIdQuery) {
      const sId = Number(sessionIdQuery);
      setSessionId(sId);
      initialScrollDoneRef.current = false;
      sessions.messages(sId, { limit: PAGE_SIZE })
        .then((data) => {
          setMsgs(data.map(mapMsg));
          setHasMore(data.length === PAGE_SIZE);
        }).catch(() => { });
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
      setHasMore(false);
    }
  }, [id, sessionIdQuery, sessionsList, searchParams, router]);

  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

  // Jump to bottom on initial load; smooth scroll to bottom whenever a new message is appended
  useEffect(() => {
    if (isLoadingMoreRef.current || !scrollRef.current) return;
    const el = scrollRef.current;
    if (!initialScrollDoneRef.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDoneRef.current = true;
      lastMsgCountRef.current = msgs.length;
      return;
    }
    const grew = msgs.length > lastMsgCountRef.current;
    lastMsgCountRef.current = msgs.length;
    if (grew || busy) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [msgs, busy]);

  // Scroll listener — triggers load when user scrolls within 80px of the top
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !sessionId) return;

    const MIN_MS = 350;
    const EXIT_MS = 200;
    const loadForSession = sessionId;

    function loadOlder() {
      if (isLoadingMoreRef.current || !hasMoreRef.current) return;
      const oldestId = msgsRef.current[0]?.id;
      if (!oldestId) return;

      isLoadingMoreRef.current = true;
      loadSessionIdRef.current = loadForSession;
      setSpinnerPhase('entering');
      const startedAt = Date.now();

      sessions.messages(loadForSession, { limit: PAGE_SIZE, before_id: oldestId })
        .then((data) => {
          // Drop result if user switched sessions mid-flight
          if (loadSessionIdRef.current !== loadForSession) return;

          const fetched = data.map(mapMsg);
          const nextHasMore = data.length === PAGE_SIZE;

          const finish = () => {
            setSpinnerPhase('exiting');
            setTimeout(() => {
              if (fetched.length === 0) {
                hasMoreRef.current = false;
                setHasMore(false);
                setSpinnerPhase('hidden');
                isLoadingMoreRef.current = false;
                return;
              }
              // Capture position BEFORE the prepend + spinner-hide commit
              const sc = scrollRef.current;
              const prevHeight = sc?.scrollHeight ?? 0;
              const prevScrollTop = sc?.scrollTop ?? 0;

              hasMoreRef.current = nextHasMore;
              setHasMore(nextHasMore);
              setMsgs((prev) => [...fetched, ...prev]);
              setSpinnerPhase('hidden');

              requestAnimationFrame(() => {
                const sc2 = scrollRef.current;
                if (sc2) {
                  sc2.scrollTop = prevScrollTop + (sc2.scrollHeight - prevHeight);
                }
                isLoadingMoreRef.current = false;
              });
            }, EXIT_MS);
          };

          // Skip the artificial delay when there's nothing to show
          if (fetched.length === 0) {
            finish();
            return;
          }
          const wait = Math.max(0, MIN_MS - (Date.now() - startedAt));
          if (wait === 0) finish();
          else setTimeout(finish, wait);
        })
        .catch(() => {
          setSpinnerPhase('hidden');
          isLoadingMoreRef.current = false;
        });
    }

    function onScroll() {
      const distanceFromBottom = el!.scrollHeight - el!.scrollTop - el!.clientHeight;
      setShowScrollBottom(distanceFromBottom > 240);
      if (!hasMoreRef.current || isLoadingMoreRef.current) return;
      if (el!.scrollTop < 80) loadOlder();
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      // Invalidate any in-flight load for this session
      if (loadSessionIdRef.current === loadForSession) {
        loadSessionIdRef.current = undefined;
      }
    };
  }, [sessionId]);

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
      const freshData = await sessions.messages(r.session_id, { limit: PAGE_SIZE });
      setMsgs(freshData.map(mapMsg));
      setHasMore(freshData.length === PAGE_SIZE);
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

  const totalIn = msgs.reduce((s, m) => s + (m.tokens_in || 0), 0);
  const totalOut = msgs.reduce((s, m) => s + (m.tokens_out || 0), 0);

  return (
    <AppShell
      rightPanel={
        rightPanelOpen ? (
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
        ) : undefined
      }
    >
      <div className="flex h-full min-w-0 overflow-hidden relative">
        {/* Left pane: Chat History */}
        {leftPanelOpen && (
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
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {sessionsList.length === 0 ? (
                <div className="flex-1 overflow-y-auto p-2">
                  <p className="text-[11.5px] text-muted-foreground p-3 text-center">{t("noHistory")}</p>
                </div>
              ) : (
                <>
                  {/* Top Zone: Pinned Sessions */}
                  <div className="flex-shrink-0 flex flex-col border-b border-border overflow-hidden" style={{ height: pinnedHeight ? `${pinnedHeight}px` : '25%' }}>
                    <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex-shrink-0">
                      Pinned
                    </div>
                    <div className="flex-1 overflow-y-auto px-2">
                      {sessionsList.filter((s) => s.is_pinned && !s.is_archived).length === 0 ? (
                        <p className="text-[11.5px] text-muted-foreground/60 p-3 text-center italic">No pinned chats</p>
                      ) : (
                        <div>
                          {sessionsList
                            .filter((s) => s.is_pinned && !s.is_archived)
                            .map((s, idx, arr) => (
                              <div key={s.id} className="">
                                <SessionListItem
                                  session={s}
                                  agent={ags[s.agent_id]}
                                  isActive={sessionId === s.id}
                                  onNavigate={() => router.push(`/chat/${s.agent_id}?session_id=${s.id}` as any)}
                                  onRename={() => setRenameTarget(s)}
                                  onPin={() => handleTogglePin(s.id, !s.is_pinned)}
                                  onDelete={() => setDeleteTarget(s)}
                                  onDragStart={handleSessionDragStart(s)}
                                />
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resize Handle 1 */}
                  <div
                    onMouseDown={handleResizeStart('pinned-groups')}
                    className="h-1 bg-border hover:bg-primary cursor-row-resize flex-shrink-0 transition-colors"
                    title="Drag to resize"
                  />

                  {/* Center Zone: Groups */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-b border-border" style={{ height: groupsHeight ? `${groupsHeight}px` : 'auto' }}>
                    <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex-shrink-0 flex items-center justify-between">
                      <span>Groups</span>
                      <button
                        onClick={() => setShowNewGroupDialog(true)}
                        className="p-0.5 rounded hover:bg-accent/50 transition-colors flex-shrink-0"
                        title="Create group"
                        aria-label="Create group"
                      >
                        <Plus className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2">
                      {groups.length === 0 ? (
                        <p className="text-[11.5px] text-muted-foreground/60 p-3 text-center italic">No groups yet</p>
                      ) : (
                        <div className="space-y-1">
                          {groups.map((group) => {
                            const groupSessions = sessionsList.filter(
                              (s) => s.group_id === group.id && !s.is_archived
                            );
                            return (
                              <div
                                key={group.id}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "move";
                                }}
                                onDrop={handleGroupDrop(group.id)}
                                className={`border border-border rounded-md p-2 ${getGroupBgColor(group.id)}`}
                              >
                                <div className="flex items-center justify-between group/header mb-1">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="w-2 h-2 rounded-full bg-primary/70"></div>
                                    <div className="text-[10px] font-semibold text-foreground uppercase tracking-wide">
                                      {group.name}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
                                    <div
                                      onClick={() => setGroupToDelete(group)}
                                      className="p-1 rounded cursor-pointer hover:bg-accent/50 transition-colors"
                                      title="Delete group"
                                    >
                                      <Trash2 className="size-3 text-muted-foreground hover:text-red-600" />
                                    </div>
                                  </div>
                                </div>
                                <div className="min-h-[20px]">
                                  {groupSessions.length === 0 ? (
                                    <p className="text-[11.5px] text-muted-foreground/60 p-3 text-center italic">{t("emptyGroup")}</p>
                                  ) : (
                                    groupSessions.map((s, idx) => (
                                      <div key={s.id} className={idx < groupSessions.length - 1 ? "border-b border-border" : ""}>
                                        <SessionListItem
                                          session={s}
                                          agent={ags[s.agent_id]}
                                          isActive={sessionId === s.id}
                                          onNavigate={() => router.push(`/chat/${s.agent_id}?session_id=${s.id}` as any)}
                                          onRename={() => setRenameTarget(s)}
                                          onPin={() => handleTogglePin(s.id, !s.is_pinned)}
                                          onDelete={() => setDeleteTarget(s)}
                                          onDragStart={handleSessionDragStart(s)}
                                        />
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resize Handle 2 */}
                  <div
                    onMouseDown={handleResizeStart('groups-ungrouped')}
                    className="h-1 bg-border hover:bg-primary cursor-row-resize flex-shrink-0 transition-colors"
                    title="Drag to resize"
                  />

                  {/* Bottom Zone: Ungrouped Sessions */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 flex-shrink-0">
                      <Link2Off className="size-3" />
                      Ungrouped
                    </div>
                    <div
                      className="flex-1 overflow-y-auto px-2"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={handleUngroupDrop}
                    >
                      {sessionsList.some((s) => !s.group_id && !s.is_pinned && !s.is_archived) ? (
                        <div className="space-y-1">
                          {sessionsList
                            .filter((s) => !s.group_id && !s.is_pinned && !s.is_archived)
                            .map((s, idx, arr) => (
                              <div key={s.id} className="">
                                <SessionListItem
                                  session={s}
                                  agent={ags[s.agent_id]}
                                  isActive={sessionId === s.id}
                                  onNavigate={() => router.push(`/chat/${s.agent_id}?session_id=${s.id}` as any)}
                                  onRename={() => setRenameTarget(s)}
                                  onPin={() => handleTogglePin(s.id, !s.is_pinned)}
                                  onDelete={() => setDeleteTarget(s)}
                                  onDragStart={handleSessionDragStart(s)}
                                />
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-[11.5px] text-muted-foreground/60 p-3 text-center italic">Drag here to ungroup</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}

        {/* Left panel toggle button - sticky at right edge of panel */}
        <div
          className="fixed top-1/2 z-50 pointer-events-none transform -translate-y-1/2 transition-all duration-300"
          style={{ left: leftPanelOpen ? '456px' : '240px' }}
        >
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full shadow-xl hover:bg-accent pointer-events-auto border-2"
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            aria-label={leftPanelOpen ? t("closePanel") : t("showPanel")}
            title={leftPanelOpen ? t("closePanel") : t("showPanel")}
          >
            {leftPanelOpen ? (
              <ChevronLeft className="size-5" />
            ) : (
              <ChevronRight className="size-5" />
            )}
          </Button>
        </div>

        {/* Right pane: Chat Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
          <Topbar
            title={
              <span className="flex items-center gap-2">
                <span className="font-medium text-md">{agent?.name ?? "Agent"}</span>
                {agent && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
                    {models.find((m) => m.id === agent.model_id)?.display_name || `Model #${agent.model_id}`}
                  </span>
                )}
              </span>
            }
            subtitle={
              <span className="flex items-center gap-2 mt-0.5">
                <span className="truncate max-w-[280px]">{agent?.description}</span>
              </span>
            }
            right={<span className="font-mono text-[10.5px] text-muted-foreground">{sessionId ? t("sessionLabel", { id: sessionId }) : t("newChatLabel")}</span>}
          />

          <div className="flex-1 flex flex-col min-h-0 relative">
            {showScrollBottom && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  const el = scrollRef.current;
                  if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                }}
                className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20 h-9 w-9 rounded-full shadow-lg border bg-background/95 backdrop-blur hover:bg-accent"
                aria-label="Scroll to bottom"
                title="Scroll to bottom"
              >
                <ArrowDown className="size-4" />
              </Button>
            )}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-8">
                {msgs.length === 0 && !busy ? (
                  <Welcome name={agent?.name} />
                ) : (
                  <div>
                    {/* Spinner: drop in from above, exit up */}
                    {spinnerPhase !== 'hidden' && (
                      <div
                        className="py-4 flex justify-center overflow-hidden"
                        style={{
                          animation: spinnerPhase === 'exiting'
                            ? 'spinner-drop-out 0.28s ease-in forwards'
                            : 'spinner-drop-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
                        }}
                      >
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {msgs.map((m, i) => (
                      <div
                        key={m.id ?? i}
                        data-msg-id={i === 0 && m.id ? m.id : undefined}
                        className={`py-6 ${i === 0 ? "pt-0" : ""} ${i === msgs.length - 1 && !busy ? "pb-0" : ""}`}
                      >
                        <Bubble msg={m} msgs={msgs} msgIndex={i} />
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

          {/* Toggle button - sticky at center of panel edge */}
          <div
            className="fixed top-1/2 z-50 pointer-events-none transform -translate-y-1/2 transition-all duration-300"
            style={{ right: rightPanelOpen ? 'calc(320px - 24px)' : '24px' }}
          >
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full shadow-xl hover:bg-accent pointer-events-auto border-2"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              aria-label={rightPanelOpen ? t("closePanel") : t("showPanel")}
              title={rightPanelOpen ? t("closePanel") : t("showPanel")}
            >
              {rightPanelOpen ? (
                <ChevronRight className="size-5" />
              ) : (
                <ChevronLeft className="size-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Session Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteSession")}</DialogTitle>
            <DialogDescription>
              Archive "{deleteTarget?.title}"? You can restore it later from archived sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteSession}>
              {t("archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Session Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameSession")}</DialogTitle>
            <DialogDescription>
              Enter a new title for this chat session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSession();
                if (e.key === "Escape") setRenameTarget(null);
              }}
              className="w-full px-3 py-2 border border-border rounded bg-background text-foreground outline-none focus:ring-2 focus:ring-primary"
              placeholder="Session title..."
              autoFocus
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleRenameSession}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createGroup")}</DialogTitle>
            <DialogDescription>
              Create a new folder to organize your chats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createNewGroup();
                if (e.key === "Escape") setShowNewGroupDialog(false);
              }}
              className="w-full px-3 py-2 border border-border rounded bg-background text-foreground outline-none focus:ring-2 focus:ring-primary"
              placeholder="Group name..."
              autoFocus
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewGroupDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={createNewGroup}>
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
            <DialogDescription>
              Delete "{groupToDelete?.name}"? All chats in this group will be moved to the main list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setGroupToDelete(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SessionListItem({
  session,
  agent,
  isActive,
  onNavigate,
  onRename,
  onPin,
  onDelete,
  onDragStart,
}: {
  session: any;
  agent: any;
  isActive: boolean;
  onNavigate: () => void;
  onRename: () => void;
  onPin: () => void;
  onDelete: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-1 group cursor-move hover:cursor-pointer ${isActive
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:bg-accent/40"
        }`}
    >
      <button onClick={onNavigate} className="flex-1 min-w-0 text-left cursor-pointer">
        <span className="text-[12.5px] truncate block text-foreground font-medium">
          {session.title}
        </span>
        <span className="text-[9.5px] text-muted-foreground block truncate">
          {agent?.name || "Agent"} · {formatSessionTime(session.created_at)}
        </span>
      </button>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          title={session.is_pinned ? "Unpin" : "Pin"}
        >
          {session.is_pinned ? (
            <Pin className="size-3 fill-current" />
          ) : (
            <Pin className="size-3" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          title="Rename"
        >
          <Edit2 className="size-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
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

function Bubble({ msg, msgs = [], msgIndex = -1 }: { msg: Msg; msgs?: Msg[]; msgIndex?: number }) {
  const t = useTranslations("ChatPage");
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";

  // Helper to get model name from preceding tool message
  const getModelNameFromPrecedingTool = (): string | null => {
    if (msgIndex <= 0) return null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (msgs[i].role === "tool") {
        try {
          const imgGenData = parseImageGenerationJson(msgs[i].content);
          if (imgGenData?.model) {
            return imgGenData.model;
          }
        } catch { }
      }
    }
    return null;
  };

  if (isTool) {
    return (
      <div className="flex gap-4 items-center pl-11 py-1">
        <div className="w-5 h-5 rounded bg-muted border border-border flex items-center justify-center text-[10px] text-muted-foreground shrink-0 font-mono">
          T
        </div>
        <details className="flex-1 min-w-0 group" open>
          <summary className="text-[11.5px] font-medium text-muted-foreground cursor-pointer hover:underline select-none">
            {t("toolOutput")} (ID: {msg.tool_call_id?.slice(0, 8) || "call"})
          </summary>
          <div className="mt-1.5">
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
    } catch (e) { }
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
            {isUser ? msg.content : renderContentWithImages(msg.content, !isUser ? getModelNameFromPrecedingTool() : null)}
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
    <div className="flex flex-col h-full relative">
      <div className="px-5 pt-4 pb-3 shrink-0 border-b border-border">
        <div className="text-[13px] font-semibold text-foreground">{t("properties")}</div>
      </div>
      <div className="p-5 space-y-6 max-h-screen overflow-y-auto pb-20 flex-1">
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
