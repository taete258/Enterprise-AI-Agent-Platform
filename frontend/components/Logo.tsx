import { Sparkles } from "lucide-react";

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-md bg-primary grid place-items-center shrink-0">
        <Sparkles className="size-4 text-secondary" strokeWidth={2.2} />
      </div>
      <div className="leading-none">
        <div className="font-serif text-[15px] text-foreground tracking-tight">Studio</div>
        <div className="text-[10.5px] text-muted-foreground mt-0.5">AI Agent · enterprise</div>
      </div>
    </div>
  );
}
