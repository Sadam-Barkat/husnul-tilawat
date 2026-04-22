import { useEffect, useState } from "react";
import axios from "axios";
import { adminAuthHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";

type UserRow = { _id: string; name: string; email: string; role: string; createdAt?: string };

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: "", email: "", newPassword: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);

  const load = () => {
    axios
      .get<{ items: UserRow[]; total: number }>("/api/admin/users", {
        headers: adminAuthHeaders(),
        params: { page, limit: 15, search: search || undefined },
      })
      .then(({ data }) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => toast({ title: "Failed to load users", variant: "destructive" }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openEdit = (u: UserRow) => {
    setEdit(u);
    setForm({ name: u.name, email: u.email, newPassword: "" });
  };

  const saveUser = async () => {
    if (!edit) return;
    try {
      await axios.patch(
        `/api/admin/users/${edit._id}`,
        {
          name: form.name,
          email: form.email,
          ...(form.newPassword ? { newPassword: form.newPassword } : {}),
        },
        { headers: adminAuthHeaders() }
      );
      toast({ title: "User updated" });
      setEdit(null);
      load();
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: m || "Update failed", variant: "destructive" });
    }
  };

  const deleteUser = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
    try {
      await axios.delete(`/api/admin/users/${id}`, { headers: adminAuthHeaders() });
      toast({ title: "User deleted" });
      load();
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: m || "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Learners</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Public accounts only. Administrator accounts are not listed here (manage via database / seed script).
      </p>
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search name or email…"
          className="max-w-xs bg-zinc-900 border-zinc-700 text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
        />
        <Button
          variant="secondary"
          className="bg-amber-600/20 text-amber-200 border border-amber-500/30"
          onClick={() => {
            setPage(1);
            axios
              .get<{ items: UserRow[]; total: number }>("/api/admin/users", {
                headers: adminAuthHeaders(),
                params: { page: 1, limit: 15, search: search || undefined },
              })
              .then(({ data }) => {
                setItems(data.items);
                setTotal(data.total);
              })
              .catch(() => toast({ title: "Failed to load users", variant: "destructive" }));
          }}
        >
          Search
        </Button>
      </div>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Name</TableHead>
              <TableHead className="text-zinc-400">Email</TableHead>
              <TableHead className="text-zinc-400 w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u._id} className="border-zinc-800">
                <TableCell className="text-white">{u.name}</TableCell>
                <TableCell className="text-zinc-400">{u.email}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400" onClick={() => openEdit(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-400/80"
                      onClick={() => setDeleteConfirm({ id: u._id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-2 mt-4 text-sm text-zinc-500">
        <span>
          {total} learner{total !== 1 ? "s" : ""}
          {total > 15 ? ` · Page ${page} of ${Math.ceil(total / 15) || 1}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            className="border-zinc-700"
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 15 >= total}
            className="border-zinc-700"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit learner</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input
                className="bg-zinc-950 border-zinc-600 mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="bg-zinc-950 border-zinc-600 mt-1"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>New password (optional)</Label>
              <Input
                type="password"
                className="bg-zinc-950 border-zinc-600 mt-1"
                placeholder="Leave empty to keep current"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-zinc-800 border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:text-white" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-500 text-zinc-950" onClick={saveUser}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete learner?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete this user and all their feedback, recitations, and quiz data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mt-2 border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white sm:mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
