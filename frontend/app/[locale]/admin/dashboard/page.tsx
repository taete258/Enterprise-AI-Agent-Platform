"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const t = useTranslations("DashboardPage");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => { admin.costs(days).then(setData).catch((e) => setErr(e.message)); }, [days]);

  const fmt = (n: number) => n.toLocaleString();
  const $ = (n: number) => `$${n.toFixed(4)}`;

  return (
    <section>
      <PageHeader title={t("title")} subtitle={t("subtitle")}
        action={
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[7, 30, 90, 365].map((d) => <SelectItem key={d} value={String(d)}>{t("days", { count: d })}</SelectItem>)}
            </SelectContent>
          </Select>
        } />
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        {err && <Card className="border-destructive/40"><CardContent className="pt-4 text-[13px] text-destructive">{err}</CardContent></Card>}
        {!data && !err && <Card><CardContent className="pt-6 text-center text-[13px] text-muted-foreground">{t("loading")}</CardContent></Card>}

        {data && (
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <Stat label={t("tokensIn")}  value={fmt(data.total.tokens_in)} />
              <Stat label={t("tokensOut")} value={fmt(data.total.tokens_out)} />
              <Stat label={t("cost")} value={$(data.total.cost_usd)} highlight />
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <CostTrendChart daily={data.daily} />
              <TokenTrendChart daily={data.daily} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <Breakdown title={t("byUser")} rows={data.by_user} noDataLabel={t("noData")} />
              <Breakdown title={t("byAgent")} rows={data.by_agent} noDataLabel={t("noData")} />
            </div>
            <UserUsageTable rows={data.by_user} />
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="pt-5">
        <div className="section-h">{label}</div>
        <div className={`font-serif text-3xl tracking-tight mt-2 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Breakdown({ title, rows, noDataLabel }: { title: string; rows: any[]; noDataLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.cost_usd));
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="section-h mb-4">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-3">{noDataLabel}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-foreground truncate">{r.label}</span>
                  <span className="text-muted-foreground tabular-nums font-mono text-[12px]">${r.cost_usd.toFixed(4)}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(r.cost_usd / max) * 100}%` }} />
                </div>
                <div className="text-[10.5px] text-muted-foreground mt-1 font-mono">
                  ↑ {r.tokens_in.toLocaleString()} · ↓ {r.tokens_out.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function UserUsageTable({ rows }: { rows: any[] }) {
  const t = useTranslations("DashboardPage");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("cost_usd");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary font-bold" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary font-bold" />
    );
  };

  const filteredRows = rows.filter((r) =>
    r.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    let valA: any;
    let valB: any;

    if (sortBy === "label") {
      valA = a.label.toLowerCase();
      valB = b.label.toLowerCase();
    } else if (sortBy === "tokens_in") {
      valA = a.tokens_in;
      valB = b.tokens_in;
    } else if (sortBy === "tokens_out") {
      valA = a.tokens_out;
      valB = b.tokens_out;
    } else if (sortBy === "total_tokens") {
      valA = a.tokens_in + a.tokens_out;
      valB = b.tokens_in + b.tokens_out;
    } else if (sortBy === "cost_usd") {
      valA = a.cost_usd;
      valB = b.cost_usd;
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="section-h">{t("userTableTitle")}</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3 font-semibold text-muted-foreground select-none">
                  <button onClick={() => handleSort("label")} className="flex items-center hover:text-foreground transition-colors font-semibold">
                    {t("userCol")} {renderSortIcon("label")}
                  </button>
                </th>
                <th className="p-3 font-semibold text-muted-foreground text-right select-none">
                  <button onClick={() => handleSort("tokens_in")} className="flex items-center justify-end hover:text-foreground transition-colors font-semibold ml-auto">
                    {t("tokensInCol")} {renderSortIcon("tokens_in")}
                  </button>
                </th>
                <th className="p-3 font-semibold text-muted-foreground text-right select-none">
                  <button onClick={() => handleSort("tokens_out")} className="flex items-center justify-end hover:text-foreground transition-colors font-semibold ml-auto">
                    {t("tokensOutCol")} {renderSortIcon("tokens_out")}
                  </button>
                </th>
                <th className="p-3 font-semibold text-muted-foreground text-right select-none">
                  <button onClick={() => handleSort("total_tokens")} className="flex items-center justify-end hover:text-foreground transition-colors font-semibold ml-auto">
                    {t("totalTokensCol")} {renderSortIcon("total_tokens")}
                  </button>
                </th>
                <th className="p-3 font-semibold text-muted-foreground text-right select-none">
                  <button onClick={() => handleSort("cost_usd")} className="flex items-center justify-end hover:text-foreground transition-colors font-semibold ml-auto">
                    {t("costCol")} {renderSortIcon("cost_usd")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    {t("noData")}
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => {
                  const total = r.tokens_in + r.tokens_out;
                  return (
                    <tr key={r.key} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-medium text-foreground truncate max-w-[240px]" title={r.label}>
                        {r.label}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground tabular-nums">
                        {r.tokens_in.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground tabular-nums">
                        {r.tokens_out.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground tabular-nums">
                        {total.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-primary font-semibold tabular-nums">
                        ${r.cost_usd.toFixed(4)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CostTrendChart({ daily }: { daily: any[] }) {
  const t = useTranslations("DashboardPage");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!daily || daily.length === 0) {
    return (
      <Card className="h-[280px] flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground">{t("noData")}</p>
      </Card>
    );
  }

  const width = 500;
  const height = 220;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const n = daily.length;

  const maxCost = Math.max(0.0001, ...daily.map((d) => d.cost_usd));
  
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xLabels = getXAxisLabels(daily);

  const points = daily.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, n - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.cost_usd / maxCost) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = n > 0 
    ? `${linePath} L ${points[n - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : "";

  return (
    <Card className="relative overflow-visible">
      <CardContent className="pt-5 pb-4">
        <h2 className="section-h mb-3">{t("costTrend")}</h2>
        
        <div className="relative h-[220px] w-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick, i) => {
              const y = paddingTop + chartHeight - tick * chartHeight;
              const val = tick * maxCost;
              return (
                <g key={i} className="opacity-40">
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="font-mono text-[9px] fill-muted-foreground tabular-nums"
                  >
                    ${val.toFixed(val >= 1 ? 2 : 4)}
                  </text>
                </g>
              );
            })}

            {xLabels.map((lbl, i) => {
              const x = paddingLeft + (lbl.index / Math.max(1, n - 1)) * chartWidth;
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className="font-mono text-[9.5px] fill-muted-foreground"
                >
                  {lbl.label}
                </text>
              );
            })}

            {areaPath && <path d={areaPath} fill="url(#costGrad)" />}

            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {points.map((p, i) => {
              const isHovered = hoveredIdx === i;
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5 : 2.5}
                  className="fill-card stroke-primary transition-all duration-150"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
              );
            })}

            {hoveredIdx !== null && points[hoveredIdx] && (
              <line
                x1={points[hoveredIdx].x}
                y1={paddingTop}
                x2={points[hoveredIdx].x}
                y2={paddingTop + chartHeight}
                stroke="var(--primary)"
                strokeWidth={1}
                strokeDasharray="4,4"
                className="opacity-60"
              />
            )}

            {daily.map((_, i) => {
              const sliceWidth = chartWidth / Math.max(1, n - 1 || 1);
              const x = paddingLeft + i * sliceWidth - sliceWidth / 2;
              return (
                <rect
                  key={i}
                  x={x}
                  y={paddingTop}
                  width={sliceWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {hoveredIdx !== null && daily[hoveredIdx] && (() => {
            const d = daily[hoveredIdx];
            return (
              <div
                className="absolute z-10 p-2.5 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg text-[11px] pointer-events-none transition-all duration-100"
                style={{
                  left: `${paddingLeft + (hoveredIdx / Math.max(1, n - 1)) * chartWidth}px`,
                  top: `${paddingTop}px`,
                  transform: hoveredIdx > n / 2 ? "translate(-105%, -20%)" : "translate(5%, -20%)",
                }}
              >
                <div className="font-semibold mb-1 text-foreground">{formatDateTooltip(d.day)}</div>
                <div className="font-mono text-primary font-bold">${d.cost_usd.toFixed(4)}</div>
                <div className="text-muted-foreground text-[10px] mt-0.5">
                  ↑ {d.tokens_in.toLocaleString()} · ↓ {d.tokens_out.toLocaleString()}
                </div>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

function TokenTrendChart({ daily }: { daily: any[] }) {
  const t = useTranslations("DashboardPage");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!daily || daily.length === 0) {
    return (
      <Card className="h-[280px] flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground">{t("noData")}</p>
      </Card>
    );
  }

  const width = 500;
  const height = 220;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const n = daily.length;

  const maxTokens = Math.max(1, ...daily.map((d) => Math.max(d.tokens_in, d.tokens_out)));
  
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xLabels = getXAxisLabels(daily);

  const inputPoints = daily.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, n - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.tokens_in / maxTokens) * chartHeight;
    return { x, y };
  });

  const outputPoints = daily.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, n - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.tokens_out / maxTokens) * chartHeight;
    return { x, y };
  });

  const inputLinePath = inputPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const outputLinePath = outputPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const inputAreaPath = n > 0 
    ? `${inputLinePath} L ${inputPoints[n - 1].x} ${paddingTop + chartHeight} L ${inputPoints[0].x} ${paddingTop + chartHeight} Z`
    : "";
  const outputAreaPath = n > 0 
    ? `${outputLinePath} L ${outputPoints[n - 1].x} ${paddingTop + chartHeight} L ${outputPoints[0].x} ${paddingTop + chartHeight} Z`
    : "";

  return (
    <Card className="relative overflow-visible">
      <CardContent className="pt-5 pb-4">
        <h2 className="section-h mb-3">{t("tokenTrend")}</h2>
        
        <div className="relative h-[220px] w-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {yTicks.map((tick, i) => {
              const y = paddingTop + chartHeight - tick * chartHeight;
              const val = tick * maxTokens;
              return (
                <g key={i} className="opacity-40">
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="font-mono text-[9px] fill-muted-foreground tabular-nums"
                  >
                    {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {xLabels.map((lbl, i) => {
              const x = paddingLeft + (lbl.index / Math.max(1, n - 1)) * chartWidth;
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className="font-mono text-[9.5px] fill-muted-foreground"
                >
                  {lbl.label}
                </text>
              );
            })}

            {inputAreaPath && <path d={inputAreaPath} fill="url(#inputGrad)" />}
            {outputAreaPath && <path d={outputAreaPath} fill="url(#outputGrad)" />}

            {inputLinePath && (
              <path
                d={inputLinePath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {outputLinePath && (
              <path
                d={outputLinePath}
                fill="none"
                stroke="var(--secondary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {inputPoints.map((p, i) => {
              const isHovered = hoveredIdx === i;
              return (
                <circle
                  key={`in-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4.5 : 2}
                  className="fill-card stroke-primary transition-all duration-150"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
              );
            })}

            {outputPoints.map((p, i) => {
              const isHovered = hoveredIdx === i;
              return (
                <circle
                  key={`out-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4.5 : 2}
                  className="fill-card stroke-secondary transition-all duration-150"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
              );
            })}

            {hoveredIdx !== null && inputPoints[hoveredIdx] && (
              <line
                x1={inputPoints[hoveredIdx].x}
                y1={paddingTop}
                x2={inputPoints[hoveredIdx].x}
                y2={paddingTop + chartHeight}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="4,4"
                className="opacity-80"
              />
            )}

            {daily.map((_, i) => {
              const sliceWidth = chartWidth / Math.max(1, n - 1 || 1);
              const x = paddingLeft + i * sliceWidth - sliceWidth / 2;
              return (
                <rect
                  key={i}
                  x={x}
                  y={paddingTop}
                  width={sliceWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>

          {hoveredIdx !== null && daily[hoveredIdx] && (() => {
            const d = daily[hoveredIdx];
            return (
              <div
                className="absolute z-10 p-2.5 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg text-[11px] pointer-events-none transition-all duration-100"
                style={{
                  left: `${paddingLeft + (hoveredIdx / Math.max(1, n - 1)) * chartWidth}px`,
                  top: `${paddingTop}px`,
                  transform: hoveredIdx > n / 2 ? "translate(-105%, -20%)" : "translate(5%, -20%)",
                }}
              >
                <div className="font-semibold mb-1 text-foreground">{formatDateTooltip(d.day)}</div>
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">In:</span>
                  <span className="font-mono font-semibold text-foreground">{d.tokens_in.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  <div className="h-2 w-2 rounded-full bg-secondary" />
                  <span className="text-muted-foreground">Out:</span>
                  <span className="font-mono font-semibold text-foreground">{d.tokens_out.toLocaleString()}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
}

function getXAxisLabels(daily: any[]) {
  const n = daily.length;
  if (n === 0) return [];
  if (n <= 5) return daily.map((d, idx) => ({ label: formatDateLabel(d.day), index: idx }));
  
  const indices = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1];
  return Array.from(new Set(indices)).map(idx => ({
    label: formatDateLabel(daily[idx].day),
    index: idx
  }));
}

function formatDateLabel(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const [_, m, d] = parts;
  return `${d}/${m}`;
}

function formatDateTooltip(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mIdx = parseInt(m, 10) - 1;
  return `${d} ${months[mIdx] || m} ${y}`;
}

