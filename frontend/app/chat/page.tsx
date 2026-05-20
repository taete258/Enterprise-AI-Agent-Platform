"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { sessions } from "@/lib/api";
import AppShell from "@/components/AppShell";

export default function ChatsListPage() {
  const router = useRouter();

  useEffect(() => {
    sessions.list()
      .then((list) => {
        if (list && list.length > 0) {
          const lastSession = list[0]; // first session is the most recent
          router.replace(`/chat/${lastSession.agent_id}?session_id=${lastSession.id}`);
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
        <p className="text-muted-foreground text-[14px]">Loading last chat session...</p>
      </div>
    </AppShell>
  );
}
