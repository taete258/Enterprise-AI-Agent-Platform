export default function Topbar({ title, subtitle, right }: {
  title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-sidebar/60 backdrop-blur px-5 flex items-center justify-between sticky top-0 z-10 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-foreground break-words">{title}</div>
        {subtitle && <div className="text-[10.5px] text-muted-foreground break-words">{subtitle}</div>}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0 ml-4">{right}</div>}
    </div>
  );
}
