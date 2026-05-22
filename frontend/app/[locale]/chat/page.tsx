"use client";
import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { sessions } from "@/lib/api";
import AppShell from "@/components/AppShell";

export default function ChatsListPage() {
  const router = useRouter();
  const t = useTranslations("ChatPage");

  useEffect(() => {
    sessions.list()
      .then((list) => {
        if (list && list.length > 0) {
          // Prefer the last active session from localStorage
          let target = list[0];
          const savedRaw = typeof window !== "undefined" ? localStorage.getItem("lastActiveSession") : null;
          if (savedRaw) {
            try {
              const { agentId: savedAgentId, sessionId: savedSessionId } = JSON.parse(savedRaw);
              const saved = list.find((s: any) => s.id === savedSessionId && s.agent_id === savedAgentId && !s.is_archived);
              if (saved) target = saved;
            } catch { }
          }
          router.replace(`/chat/${target.agent_id}?session_id=${target.id}` as any);
        } else {
          router.replace("/agents");
        }
      })
      .catch(() => {
        router.replace("/agents");
      });
  }, [router]);

  return (
    <AppShell>
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground text-[14px]">{t("loadingSession")}</p>
      </div>
    </AppShell>
  );
}
