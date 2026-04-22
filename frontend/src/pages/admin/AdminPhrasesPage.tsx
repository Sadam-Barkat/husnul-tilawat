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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Phrase = {
  _id: string;
  label: string;
  text: string;
  textForComparison?: string;
  category?: string;
  level?: string;
  order: number;
  isActive?: boolean;
};

const PAGE_SIZE = 25;

export default function AdminPhrasesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Phrase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState<Partial<Phrase>>({
    label: "",
    text: "",
    textForComparison: "",
    category: "",
    level: "beginner",
    order: 0,
    isActive: true,
  });

  const refetch = (p: number) =>
    axios
      .get<{ items: Phrase[]; total: number }>("/api/admin/practice-phrases", {
        headers: adminAuthHeaders(),
        params: { page: p, limit: PAGE_SIZE },
      })
      .then(({ data }) => {
        setItems(data.items);
        setTotal(data.total);
      });

  useEffect(() => {
    refetch(page).catch(() => toast({ title: "Failed to load phrases", variant: "destructive" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const save = async () => {
    try {
      const body = {
        label: form.label,
        text: form.text,
        textForComparison: form.textForComparison || undefined,
        category: form.category,
        level: form.level,
        order: Number(form.order) || 0,
        isActive: form.isActive !== false,
      };
      if (editing) {
        await axios.put(`/api/admin/practice-phrases/${editing._id}`, body, { headers: adminAuthHeaders() });
        toast({ title: "Phrase updated" });
      } else {
        await axios.post("/api/admin/practice-phrases", body, { headers: adminAuthHeaders() });
        toast({ title: "Phrase created" });
      }
      setOpen(false);
      if (editing) refetch(page).catch(() => {});
      else if (page !== 1) setPage(1);
      else refetch(1).catch(() => {});
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
      await axios.delete(`/api/admin/practice-phrases/${id}`, { headers: adminAuthHeaders() });
      toast({ title: "Deleted" });
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
          <h1 className="text-2xl font-bold text-white mb-1">Pronunciation phrases</h1>
          <p className="text-zinc-500 text-sm">AI Pronunciation page — reference lines learners practice.</p>
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-500 text-zinc-950 gap-2"
          onClick={() => {
            setEditing(null);
            setForm({
              label: "",
              text: "",
              textForComparison: "",
              category: "",
              level: "beginner",
              order: total + 1,
              isActive: true,
            });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4" /> Add phrase
        </Button>
      </div>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Label</TableHead>
              <TableHead className="text-zinc-400">Arabic</TableHead>
              <TableHead className="text-zinc-400 w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p._id} className="border-zinc-800">
                <TableCell className="text-white">{p.label}</TableCell>
                <TableCell className="font-arabic text-lg text-zinc-300 max-w-md truncate" dir="rtl">
                  {p.text}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(p);
                        setForm({ ...p });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400/80" onClick={() => setDeleteConfirm({ id: p._id })}>
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
          {total} phrase{total !== 1 ? "s" : ""}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit phrase" : "New phrase"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Label</Label>
              <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.label || ""} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <Label>Arabic text (with harakat)</Label>
              <Textarea className="bg-zinc-950 border-zinc-600 mt-1 font-arabic text-lg" dir="rtl" value={form.text || ""} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} />
            </div>
            <div>
              <Label>Plain for STT (optional — auto if empty)</Label>
              <Textarea className="bg-zinc-950 border-zinc-600 mt-1 font-arabic" dir="rtl" value={form.textForComparison || ""} onChange={(e) => setForm((f) => ({ ...f, textForComparison: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Category</Label>
                <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.category || ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <Label>Order</Label>
                <Input type="number" className="bg-zinc-950 border-zinc-600 mt-1" value={form.order ?? 0} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-zinc-800 border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:text-white" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-amber-600 text-zinc-950" onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete phrase?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This pronunciation phrase will be permanently deleted. This cannot be undone.
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
