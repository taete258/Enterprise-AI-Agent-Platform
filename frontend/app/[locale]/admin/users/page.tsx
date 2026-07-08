"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Edit2, Trash2, Shield } from "lucide-react";
import { useTranslations } from "next-intl";

export default function UsersPage() {
  const t = useTranslations("UsersPage");
  const [users, setUsers] = useState<any[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ email: "", full_name: "", password: "" });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [rolesTarget, setRolesTarget] = useState<any | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    const [u, r] = await Promise.all([admin.users(), admin.roles()]);
    setUsers(u);
    setAllRoles(r);
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await admin.createUser(form); setForm({ email: "", full_name: "", password: "" }); load(); }
    catch (e: any) { setErr(e.message); }
  }

  function startEdit(user: any) {
    setEditingUser(user);
    setEditForm({ email: user.email, full_name: user.full_name, password: "" });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const updateData: any = { email: editForm.email, full_name: editForm.full_name };
      if (editForm.password) updateData.password = editForm.password;
      await admin.updateUser(editingUser.id, updateData);
      setEditingUser(null);
      setEditForm({ email: "", full_name: "", password: "" });
      load();
    } catch (e: any) { setErr(e.message); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await admin.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: any) { setErr(e.message); setDeleteTarget(null); }
  }

  function openRoles(user: any) {
    setRolesTarget(user);
    setSelectedRoleIds((user.roles || []).map((r: any) => r.id));
  }

  async function saveRoles() {
    if (!rolesTarget) return;
    try {
      const currentIds: number[] = (rolesTarget.roles || []).map((r: any) => r.id);
      const toAdd = selectedRoleIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !selectedRoleIds.includes(id));
      await Promise.all([
        ...toAdd.map((roleId) => admin.assignRole(rolesTarget.id, roleId)),
        ...toRemove.map((roleId) => admin.removeRole(rolesTarget.id, roleId)),
      ]);
      setRolesTarget(null);
      load();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <section>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>{t("email")}</Label>
                <Input type="email" required value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fullName")}</Label>
                <Input value={form.full_name}
                       onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("password")}</Label>
                <Input type="password" required value={form.password}
                       onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              {err && (
                <Alert variant="destructive" className="sm:col-span-3">
                  <AlertCircle className="size-4" /><AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <div className="sm:col-span-3"><Button>{t("addUser")}</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                {[t("id"), t("email"), t("fullName"), "Roles", t("status"), t("actions")].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-accent/40">
                  <td className="px-3 py-2.5 text-muted-foreground">#{u.id}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarFallback>{u.email[0].toUpperCase()}</AvatarFallback></Avatar>
                      <span className="font-medium">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{u.full_name || "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || []).length === 0 ? (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      ) : (
                        (u.roles || []).map((r: any) => (
                          <span key={r.id} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{r.name}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 space-x-1">
                    {u.is_superuser && <Badge variant="default">Superuser</Badge>}
                    <Badge variant={u.is_active ? "success" : "muted"}>{u.is_active ? "active" : "inactive"}</Badge>
                  </td>
                  <td className="px-3 py-2.5 space-x-1 flex items-center">
                    <Button size="sm" variant="ghost" onClick={() => openRoles(u)} title="Assign Roles">
                      <Shield className="size-4 text-primary" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(u)}>
                      <Edit2 className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Edit User Modal */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editUser")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("email")}</Label>
                <Input type="email" required value={editForm.email}
                       onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fullName")}</Label>
                <Input value={editForm.full_name}
                       onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("password")} ({t("optional")})</Label>
                <Input type="password" value={editForm.password}
                       onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  {t("cancel")}
                </Button>
                <Button type="submit">{t("save")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Assign Roles Modal */}
        <Dialog open={!!rolesTarget} onOpenChange={(open) => !open && setRolesTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>จัดการ Roles: {rolesTarget?.email}</DialogTitle>
              <DialogDescription>เลือก roles ที่ต้องการกำหนดให้ผู้ใช้คนนี้</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {allRoles.map((role) => (
                <label key={role.id} className="flex items-start gap-3 p-2.5 rounded-lg border hover:bg-accent cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoleIds([...selectedRoleIds, role.id]);
                      } else {
                        setSelectedRoleIds(selectedRoleIds.filter((id) => id !== role.id));
                      }
                    }}
                  />
                  <div>
                    <div className="font-medium text-[13px]">{role.name}</div>
                    {role.description && (
                      <div className="text-[11px] text-muted-foreground">{role.description}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-0.5">{role.permissions.length} permissions</div>
                  </div>
                </label>
              ))}
              {allRoles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มี roles — ไปสร้างที่หน้า Roles ก่อน</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRolesTarget(null)}>{t("cancel")}</Button>
              <Button onClick={saveRoles}>บันทึก</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Modal */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
              <DialogDescription>
                {t("deleteConfirmDescription", { email: deleteTarget?.email })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                {t("confirmDelete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
