"use client";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@taete258/ds";

const LABELS: Record<string, string> = {
  th: "🇹🇭 ภาษาไทย",
  en: "🇬🇧 English",
};

export default function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSwitch(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <Select value={currentLocale} onValueChange={handleSwitch} disabled={isPending}>
      <SelectTrigger
        className="h-7 w-full text-[11.5px] bg-sidebar border-sidebar-border text-sidebar-foreground focus:ring-0 focus:ring-offset-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((loc) => (
          <SelectItem key={loc} value={loc} className="text-[11.5px]">
            {LABELS[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
