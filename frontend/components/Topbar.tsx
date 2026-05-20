export default function Topbar({ title, subtitle, right }: {
  title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="h-12 border-b border-border bg-sidebar/60 backdrop-blur px-5 flex items-center justify-between sticky top-0 z-10">
      <div className="min-w-0">
        <div className="text-[13px] text-foreground truncate">{title}</div>
        {subtitle && <div className="text-[10.5px] text-muted-foreground truncate">{subtitle}</div>}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
