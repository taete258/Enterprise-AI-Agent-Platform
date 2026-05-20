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
          const lastSession = list[0];
          router.replace(`/chat/${lastSession.agent_id}?session_id=${lastSession.id}` as any);
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
