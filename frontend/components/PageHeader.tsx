import Topbar from "./Topbar";

export default function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} right={action} />
      <header className="px-6 pt-7 pb-5 max-w-5xl mx-auto">
        <h1 className="font-serif text-2xl text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
      </header>
    </>
  );
}
