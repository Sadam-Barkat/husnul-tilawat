import { useEffect, useState } from "react";
import axios from "axios";
import { adminAuthHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Lesson = { _id: string; title: string };
type Q = {
  _id: string;
  lessonId: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  order: number;
};

const Q_PAGE = 15;

export default function AdminQuizPage() {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState<string>("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [qTotal, setQTotal] = useState(0);
  const [qPage, setQPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Q | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({
    questionText: "",
    opt0: "",
    opt1: "",
    opt2: "",
    opt3: "",
    correctIndex: 0,
    order: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const all: Lesson[] = [];
        let p = 1;
        const limit = 100;
        for (;;) {
          const { data } = await axios.get<{ items: Lesson[]; total: number }>("/api/admin/lessons", {
            headers: adminAuthHeaders(),
            params: { all: 1, page: p, limit },
          });
          all.push(...data.items);
          if (all.length >= data.total) break;
          p += 1;
          if (p > 50) break;
        }
        setLessons(all);
        setLessonId((prev) => prev || all[0]?._id || "");
      } catch {
        toast({ title: "Failed to load lessons", variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchQs = (page: number) => {
    if (!lessonId) return Promise.resolve();
    return axios
      .get<{ items: Q[]; total: number }>("/api/admin/quiz/questions", {
        headers: adminAuthHeaders(),
        params: { lessonId, page, limit: Q_PAGE },
      })
      .then(({ data }) => {
        setQuestions(data.items);
        setQTotal(data.total);
      });
  };

  useEffect(() => {
    if (!lessonId) return;
    refetchQs(qPage).catch(() => toast({ title: "Failed to load questions", variant: "destructive" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, qPage]);

  const save = async () => {
    const options = [form.opt0, form.opt1, form.opt2, form.opt3].filter(Boolean);
    if (options.length < 2 || !form.questionText.trim()) {
      toast({ title: "Need question + at least 2 options", variant: "destructive" });
      return;
    }
    if (form.correctIndex < 0 || form.correctIndex >= options.length) {
      toast({ title: "Correct index must match an option", variant: "destructive" });
      return;
    }
    try {
      const body = {
        lessonId,
        questionText: form.questionText.trim(),
        options,
        correctIndex: form.correctIndex,
        order: Number(form.order) || 0,
      };
      if (editing) {
        await axios.put(`/api/admin/quiz/questions/${editing._id}`, body, { headers: adminAuthHeaders() });
        toast({ title: "Updated" });
      } else {
        await axios.post("/api/admin/quiz/questions", body, { headers: adminAuthHeaders() });
        toast({ title: "Created" });
      }
      setOpen(false);
      if (editing) refetchQs(qPage).catch(() => {});
      else if (qPage !== 1) setQPage(1);
      else refetchQs(1).catch(() => {});
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
      await axios.delete(`/api/admin/quiz/questions/${id}`, { headers: adminAuthHeaders() });
      toast({ title: "Deleted" });
      if (questions.length <= 1 && qPage > 1) setQPage((p) => p - 1);
      else refetchQs(qPage).catch(() => {});
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      questionText: "",
      opt0: "",
      opt1: "",
      opt2: "",
      opt3: "",
      correctIndex: 0,
      order: qTotal,
    });
    setOpen(true);
  };

  const openEdit = (q: Q) => {
    setEditing(q);
    setForm({
      questionText: q.questionText,
      opt0: q.options[0] || "",
      opt1: q.options[1] || "",
      opt2: q.options[2] || "",
      opt3: q.options[3] || "",
      correctIndex: q.correctIndex,
      order: q.order,
    });
    setOpen(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Quiz questions</h1>
      <p className="text-zinc-500 text-sm mb-6">Per-lesson multiple choice.</p>
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div className="min-w-[240px]">
          <Label className="text-zinc-400">Lesson</Label>
          <Select
            value={lessonId}
            onValueChange={(id) => {
              setLessonId(id);
              setQPage(1);
            }}
          >
            <SelectTrigger className="bg-zinc-900 border-zinc-600 text-white mt-1">
              <SelectValue placeholder="Select lesson" />
            </SelectTrigger>
            <SelectContent>
              {lessons.map((l) => (
                <SelectItem key={l._id} value={l._id}>
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-amber-600 text-zinc-950 gap-2" onClick={openNew} disabled={!lessonId}>
          <Plus className="w-4 h-4" /> Add question
        </Button>
      </div>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">#</TableHead>
              <TableHead className="text-zinc-400">Question</TableHead>
              <TableHead className="text-zinc-400">Answer</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((q) => (
              <TableRow key={q._id} className="border-zinc-800">
                <TableCell className="text-zinc-500">{q.order}</TableCell>
                <TableCell className="text-zinc-200 max-w-md">{q.questionText}</TableCell>
                <TableCell className="text-amber-200/90 text-sm">{q.options[q.correctIndex]}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(q)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400/80" onClick={() => setDeleteConfirm({ id: q._id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {lessonId && (
        <div className="flex flex-wrap justify-between items-center gap-2 mt-4 text-sm text-zinc-500">
          <span>
            {qTotal} question{qTotal !== 1 ? "s" : ""} for this lesson
            {qTotal > Q_PAGE ? ` · Page ${qPage} of ${Math.ceil(qTotal / Q_PAGE) || 1}` : ""}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700"
              disabled={qPage <= 1}
              onClick={() => setQPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700"
              disabled={qPage * Q_PAGE >= qTotal}
              onClick={() => setQPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit question" : "New question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Question</Label>
              <Input className="bg-zinc-950 border-zinc-600 mt-1" value={form.questionText} onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))} />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Label>Option {i + 1}</Label>
                <Input
                  className="bg-zinc-950 border-zinc-600 mt-1"
                  value={form[`opt${i}` as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [`opt${i}`]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <Label>Correct option (0 = first)</Label>
              <Input
                type="number"
                min={0}
                max={3}
                className="bg-zinc-950 border-zinc-600 mt-1"
                value={form.correctIndex}
                onChange={(e) => setForm((f) => ({ ...f, correctIndex: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Order</Label>
              <Input type="number" className="bg-zinc-950 border-zinc-600 mt-1" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
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
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This quiz question will be permanently deleted. This cannot be undone.
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
