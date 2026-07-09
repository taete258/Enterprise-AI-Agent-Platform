"use client";
import { useEffect, useState, useMemo } from "react";
import { admin } from "@/lib/api";
import { PageHeader, Button, Input, Label, Card, CardContent, Badge, Alert, AlertDescription, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@taete258/ds";
import { AlertCircle, Edit2, Trash2, Plus, Shield, Search, X } from "lucide-react";

const RESOURCE_LABELS: Record<string, string> = {
  agent: "Agent",
  llm: "LLM / Models",
  tool: "Tools",
  knowledge: "Knowledge",
  user: "Users",
  admin: "Admin",
};

const ACTION_COLORS: Record<string, string> = {
  view: "bg-blue-100 text-blue-700",
  use: "bg-green-100 text-green-700",
  create: "bg-purple-100 text-purple-700",
  edit: "bg-yellow-100 text-yellow-700",
  delete: "bg-red-100 text-red-700",
  admin: "bg-orange-100 text-orange-700",
  manage: "bg-orange-100 text-orange-700",
};

function PermissionCheckbox({
  perm,
  checked,
  onChange,
}: {
  perm: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  const action = perm.split(":")[1] || perm;
  const colorClass = ACTION_COLORS[action] || "bg-gray-100 text-gray-700";
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${colorClass}`}>{action}</span>
    </label>
  );
}

const ALL_ACTIONS = ["view", "use", "create", "edit", "delete", "admin"];
const ACTION_ABBR: Record<string, string> = {
  view: "V", use: "U", create: "C", edit: "E", delete: "D", admin: "A",
};

function PermissionsByCategory({ permissions }: { permissions: string[] }) {
  const permSet = new Set(permissions);
  const resources = Array.from(new Set(permissions.map((p) => p.split(":")[0])));

  return (
    <div className="mt-2 -mx-1">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1 pr-2 text-muted-foreground font-medium" />
            {ALL_ACTIONS.map((action) => (
              <th key={action} title={action}
                className="text-center py-1 px-0.5 text-muted-foreground font-semibold w-7">
                {ACTION_ABBR[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource} className="border-t border-border/40">
              <td className="py-1 pr-2 font-semibold text-[9px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {RESOURCE_LABELS[resource] || resource}
              </td>
              {ALL_ACTIONS.map((action) => {
                const has = permSet.has(`${resource}:${action}`);
                const colorClass = ACTION_COLORS[action] || "bg-gray-100 text-gray-700";
                return (
                  <td key={action} className="text-center py-0.5 px-0.5">
                    {has
                      ? <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${colorClass}`}>✓</span>
                      : <span className="inline-flex items-center justify-center w-5 h-5 text-border/40 text-[9px]">·</span>
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {ALL_ACTIONS.map((a) => (
          <span key={a} className="text-[9px] text-muted-foreground">{ACTION_ABBR[a]}={a}</span>
        ))}
      </div>
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permsByResource, setPermsByResource] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });
  const [search, setSearch] = useState("");
  const [filterResource, setFilterResource] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const ALL_RESOURCES = Object.keys(permsByResource);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        role.name.toLowerCase().includes(q) ||
        (role.description || "").toLowerCase().includes(q);
      const matchesResource =
        !filterResource ||
        role.permissions.some((p: string) => p.startsWith(`${filterResource}:`));
      const matchesAction =
        !filterAction ||
        role.permissions.some((p: string) => p.endsWith(`:${filterAction}`));
      return matchesSearch && matchesResource && matchesAction;
    });
  }, [roles, search, filterResource, filterAction]);

  async function load() {
    try {
      const [r, p] = await Promise.all([admin.roles(), admin.permissions()]);
      setRoles(r);
      setPermsByResource(p.permissions);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function togglePermission(perm: string, perms: string[], setter: (p: string[]) => void) {
    if (perms.includes(perm)) {
      setter(perms.filter((p) => p !== perm));
    } else {
      setter([...perms, perm]);
    }
  }

  function toggleAll(resource: string, perms: string[], setter: (p: string[]) => void) {
    const resourcePerms = permsByResource[resource] || [];
    const allChecked = resourcePerms.every((p) => perms.includes(p));
    if (allChecked) {
      setter(perms.filter((p) => !resourcePerms.includes(p)));
    } else {
      const merged = Array.from(new Set([...perms, ...resourcePerms]));
      setter(merged);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await admin.createRole(form);
      setShowCreate(false);
      setForm({ name: "", description: "", permissions: [] });
      load();
    } catch (e: any) { setErr(e.message); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRole) return;
    try {
      await admin.updateRole(editingRole.id, {
        description: editingRole.description,
        permissions: editingRole.permissions,
      });
      setEditingRole(null);
      load();
    } catch (e: any) { setErr(e.message); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await admin.deleteRole(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) { setErr(e.message); setDeleteTarget(null); }
  }

  function PermissionGrid({ perms, onChange }: { perms: string[]; onChange: (p: string[]) => void }) {
    return (
      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {Object.entries(permsByResource).map(([resource, resPerm]) => {
          const allChecked = resPerm.every((p) => perms.includes(p));
          return (
            <div key={resource} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-foreground">{RESOURCE_LABELS[resource] || resource}</span>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-primary"
                  onClick={() => toggleAll(resource, perms, onChange)}
                >
                  {allChecked ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {resPerm.map((perm) => (
                  <PermissionCheckbox
                    key={perm}
                    perm={perm}
                    checked={perms.includes(perm)}
                    onChange={(val) => togglePermission(perm, perms, onChange)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section>
      <PageHeader title="Roles" subtitle="จัดการบทบาทและสิทธิ์การเข้าถึงระบบ" />
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        {err && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ Role หรือคำอธิบาย…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-[13px]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button onClick={() => setShowCreate(true)} className="h-9 whitespace-nowrap">
            <Plus className="size-4 mr-1" /> สร้าง Role
          </Button>
        </div>
        <div className="flex gap-2 mb-4">
          <Select value={filterResource || "__all__"} onValueChange={(v) => setFilterResource(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 flex-1 text-[12px]">
              <SelectValue placeholder="ทุก Resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทุก Resource</SelectItem>
              {ALL_RESOURCES.map((r) => (
                <SelectItem key={r} value={r}>{RESOURCE_LABELS[r] || r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAction || "__all__"} onValueChange={(v) => setFilterAction(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 flex-1 text-[12px]">
              <SelectValue placeholder="ทุก Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทุก Action</SelectItem>
              {["view", "use", "create", "edit", "delete", "admin"].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(search || filterResource || filterAction) && (
          <div className="flex items-center gap-2 mb-3 text-[12px] text-muted-foreground">
            <span>แสดง {filteredRoles.length} จาก {roles.length} roles</span>
            {(search || filterResource || filterAction) && (
              <button
                onClick={() => { setSearch(""); setFilterResource(""); setFilterAction(""); }}
                className="flex items-center gap-0.5 text-primary hover:underline"
              >
                <X className="size-3" /> ล้าง filter
              </button>
            )}
          </div>
        )}

        <div className="grid gap-4">
          {filteredRoles.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-[13px]">
              {roles.length === 0 ? "ยังไม่มี Role — กด สร้าง Role เพื่อเริ่มต้น" : "ไม่พบ Role ที่ตรงกับเงื่อนไขการค้นหา"}
            </div>
          )}
          {filteredRoles.map((role) => (
            <Card key={role.id} className="overflow-hidden">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-[13px]">{role.name}</div>
                      {role.description && (
                        <div className="text-[11px] text-muted-foreground">{role.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditingRole({ ...role, permissions: [...role.permissions] })}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(role)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {role.permissions.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground">No permissions</span>
                ) : (
                  <PermissionsByCategory permissions={role.permissions} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Modal */}
        <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setForm({ name: "", description: "", permissions: [] }); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>สร้าง Role ใหม่</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>ชื่อ Role</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น editor" />
              </div>
              <div className="space-y-1.5">
                <Label>คำอธิบาย</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="อธิบาย role นี้…" />
              </div>
              <div className="space-y-1.5">
                <Label>Permissions ({form.permissions.length} เลือกไว้)</Label>
                <PermissionGrid perms={form.permissions} onChange={(p) => setForm({ ...form, permissions: p })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>ยกเลิก</Button>
                <Button type="submit">สร้าง</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={!!editingRole} onOpenChange={(o) => { if (!o) setEditingRole(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>แก้ไข Role: {editingRole?.name}</DialogTitle></DialogHeader>
            {editingRole && (
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>คำอธิบาย</Label>
                  <Input
                    value={editingRole.description}
                    onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                    placeholder="อธิบาย role นี้…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Permissions ({editingRole.permissions.length} เลือกไว้)</Label>
                  <PermissionGrid
                    perms={editingRole.permissions}
                    onChange={(p) => setEditingRole({ ...editingRole, permissions: p })}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>ยกเลิก</Button>
                  <Button type="submit">บันทึก</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Modal */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>ลบ Role</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              คุณแน่ใจหรือว่าต้องการลบ <strong>{deleteTarget?.name}</strong>? Users ที่มี role นี้จะสูญเสียสิทธิ์ที่เกี่ยวข้อง
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={handleDelete}>ลบ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
