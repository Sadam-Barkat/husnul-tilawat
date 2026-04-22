import { useEffect, useState } from "react";
import axios from "axios";
import { adminAuthHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Lesson = {
  _id: string;
  title: string;
  slug: string;
  order: number;
  isActive: boolean;
  arabicText?: string;
  arabicTextForComparison?: string;
  description?: string;
  level?: string;
  category?: string;
  ruleSummary?: string;
  translation?: string;
  audioUrl?: string;
};

const emptyForm: Partial<Lesson> = {
  title: "",
  slug: "",
  description: "",
  level: "beginner",
  category: "",
  ruleSummary: "",
  arabicText: "",
  arabicTextForComparison: "",
  translation: "",
  audioUrl: "",
  order: 0,
  isActive: true,
};

const PAGE_SIZE = 20;

export default function AdminLessonsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Lesson[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState<Partial<Lesson>>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);

  const refetch = (p: number) =>
    axios
      .get<{ items: Lesson[]; total: number }>("/api/admin/lessons", {
        headers: adminAuthHeaders(),
        params: { all: 1, page: p, limit: PAGE_SIZE },
      })
      .then(({ data }) => {
        setItems(data.items);
        setTotal(data.total);
      });

  useEffect(() => {
    refetch(page).catch(() => toast({ title: "Failed to load lessons", variant: "destructive" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, slug: `lesson-${Date.now()}` });
    setDialogOpen(true);
  };

  const openEdit = (l: Lesson) => {
    setEditing(l);
    setForm({ ...l });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const body = {
        title: form.title,
        slug: (form.slug || "").toLowerCase().replace(/\s+/g, "-"),
        description: form.description,
        level: form.level || "beginner",
        category: form.category,
        ruleSummary: form.ruleSummary,
        arabicText: form.arabicText,
        arabicTextForComparison: form.arabicTextForComparison,
        translation: form.translation,
        audioUrl: form.audioUrl,
        order: Number(form.order) || 0,
        isActive: form.isActive !== false,
      };
      if (editing) {
        await axios.put(`/api/admin/lessons/${editing._id}`, body, { headers: adminAuthHeaders() });
        toast({ title: "Lesson updated" });
      } else {
        await axios.post("/api/admin/lessons", body, { headers: adminAuthHeaders() });
        toast({ title: "Lesson created" });
      }
      setDialogOpen(false);
      if (editing) {
        refetch(page).catch(() => {});
      } else if (page !== 1) {
        setPage(1);
      } else {
        refetch(1).catch(() => {});
      }
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: m || "Save failed", variant: "destructive" });
    }
  };

  const del = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
    try {
      await axios.delete(`/api/admin/lessons/${id}`, { headers: adminAuthHeaders() });
      toast({ title: "Lesson deleted" });
      if (items.length <= 1 && page > 1) setPage((p) => p - 1);
      else refetch(page).catch(() => {});
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Lessons</h1>
          <p className="text-zinc-500 text-sm">Create, edit, or remove Tajweed lessons.</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-500 text-zinc-950 gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" /> Add lesson
        </Button>
      </div>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Order</TableHead>
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Slug</TableHead>
              <TableHead className="text-zinc-400">Active</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((l) => (
              <TableRow key={l._id} className="border-zinc-800">
                <TableCell className="text-zinc-400">{l.order}</TableCell>
                <TableCell className="text-white font-medium">{l.title}</TableCell>
                <TableCell className="text-zinc-500 text-sm">{l.slug}</TableCell>
                <TableCell>{l.isActive ? <span className="text-emerald-400 text-xs">Yes</span> : <span className="text-zinc-600 text-xs">No</span>}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400" onClick={() => openEdit(l)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400/80" onClick={() => setDeleteConfirm({ id: l._id })}>
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
          {total} lesson{total !== 1 ? "s" : ""}
          {total > PAGE_SIZE ? ` · Page ${page} of ${Math.ceil(total / PAGE_SIZE) || 1}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-h-[90vh] overflow-y-auto max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lesson" : "New lesson"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Title</Label>
                <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Slug (unique)</Label>
                <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.slug || ""} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Order</Label>
                <Input type="number" className="bg-zinc-950 border-zinc-600 mt-1" value={form.order ?? 0} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-end pb-2 gap-2">
                <Switch checked={form.isActive !== false} onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: c }))} />
                <Label>Active</Label>
              </div>
            </div>
            <div>
              <Label>Arabic (display / TTS)</Label>
              <Textarea className="bg-zinc-950 border-zinc-600 mt-1 font-arabic text-lg" dir="rtl" value={form.arabicText || ""} onChange={(e) => setForm((f) => ({ ...f, arabicText: e.target.value }))} />
            </div>
            <div>
              <Label>Arabic for comparison (plain)</Label>
              <Textarea className="bg-zinc-950 border-zinc-600 mt-1 font-arabic" dir="rtl" value={form.arabicTextForComparison || ""} onChange={(e) => setForm((f) => ({ ...f, arabicTextForComparison: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="bg-zinc-950 border-zinc-600 mt-1" value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Rule summary</Label>
              <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.ruleSummary || ""} onChange={(e) => setForm((f) => ({ ...f, ruleSummary: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Level</Label>
                <Input className="bg-zinc-950 border-zinc-600 mt-1" placeholder="beginner" value={form.level || ""} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
              </div>
              <div>
                <Label>Category</Label>
                <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.category || ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Translation</Label>
              <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.translation || ""} onChange={(e) => setForm((f) => ({ ...f, translation: e.target.value }))} />
            </div>
            <div>
              <Label>Audio URL</Label>
              <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.audioUrl || ""} onChange={(e) => setForm((f) => ({ ...f, audioUrl: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-zinc-800 border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:text-white" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-500 text-zinc-950" onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete this lesson and all its quiz questions. User progress linked to this lesson will be updated. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mt-2 border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white sm:mt-0">
            Cancel
          </AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-red-600 hover:bg-red-500 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
