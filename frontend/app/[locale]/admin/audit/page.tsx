"use client";
import { useEffect, useState, useCallback } from "react";
import { admin, api, API_URL } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

const ACTION_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  "agent.create": "success",
  "agent.update": "warning",
  "agent.delete": "destructive",
  "chat.send": "muted",
  "knowledge.upload": "success",
  "knowledge.bind": "default",
  "knowledge.deprecate": "destructive",
};

export default function AuditPage() {
  const t = useTranslations("AuditPage");
  const locale = useLocale();

  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Filter state
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Available filters
  const [actions, setActions] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  const fetchFilters = useCallback(async () => {
    try {
      const data = await api("/api/admin/audit/filters");
      setActions(data.actions || []);
      setResourceTypes(data.resource_types || []);
    } catch (e) {
      console.error("Failed to fetch filters:", e);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: (page * pageSize).toString(),
        limit: pageSize.toString(),
        ...(search && { search }),
        ...(actionFilter && { action: actionFilter }),
        ...(resourceTypeFilter && { resource_type: resourceTypeFilter }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      });

      const data = await api(`/api/admin/audit?${params}`);
      setRows(data.items || []);
      setTotal(data.total || 0);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, actionFilter, resourceTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(0);
    fetchAuditLogs();
  };

  const handleClearFilters = () => {
    setSearch("");
    setActionFilter("");
    setResourceTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <section>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 pb-10 max-w-6xl mx-auto">
        {err && <Card className="p-4 text-[13px] text-destructive border-destructive/40 mb-4">{err}</Card>}

        {/* Filters */}
        <Card className="p-4 mb-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-[13px]"
              />

              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(0);
                }}
                className="text-[13px] px-3 py-2 rounded-md border border-input bg-background h-9"
              >
                <option value="">All Actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <select
                value={resourceTypeFilter}
                onChange={(e) => {
                  setResourceTypeFilter(e.target.value);
                  setPage(0);
                }}
                className="text-[13px] px-3 py-2 rounded-md border border-input bg-background h-9"
              >
                <option value="">All Resources</option>
                {resourceTypes.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <Input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                className="text-[13px]"
                placeholder="From"
              />

              <Input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                className="text-[13px]"
                placeholder="To"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm" className="text-[13px]" disabled={loading}>
                {loading ? "..." : "Search"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[13px]"
                onClick={handleClearFilters}
              >
                Clear
              </Button>
            </div>
          </form>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("time"), "User", "Action", "Resource", "IP", "Detail"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border hover:bg-accent/40">
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground text-[10.5px] font-mono">{new Date(r.created_at).toLocaleString(locale === "th" ? "th-TH" : "en-US")}</td>
                  <td className="px-3 py-2.5">{r.user_id ?? "—"}</td>
                  <td className="px-3 py-2.5"><Badge variant={ACTION_VARIANT[r.action] || "muted"}>{r.action}</Badge></td>
                  <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground font-mono">{r.resource_type}:{r.resource_id}</td>
                  <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground font-mono">{r.ip || "—"}</td>
                  <td className="px-3 py-2.5 text-[10.5px] text-muted-foreground font-mono max-w-md truncate" title={r.detail}>{r.detail}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">{t("noActivities")}</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-[13px] text-muted-foreground">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0 || loading}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-[12px]">
                {page > 2 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(0)}
                      disabled={loading}
                      className="min-w-8"
                    >
                      1
                    </Button>
                    <span className="text-muted-foreground">...</span>
                  </>
                )}
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const pageNum = page <= 2 ? i : Math.min(page - 2 + i, totalPages - 1);
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      disabled={loading}
                      className="min-w-8"
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
                {page < totalPages - 3 && (
                  <>
                    <span className="text-muted-foreground">...</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages - 1)}
                      disabled={loading}
                      className="min-w-8"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1 || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
