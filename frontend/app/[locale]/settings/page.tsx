"use client";
import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";

export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/theme" as any);
  }, [router]);

  return null;
}
