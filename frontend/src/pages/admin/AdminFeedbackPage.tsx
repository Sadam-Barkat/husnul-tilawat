import { useEffect, useState } from "react";
import axios from "axios";
import { adminAuthHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Trash2, Star } from "lucide-react";

type Row = {
  _id: string;
  rating: number;
  message: string;
  userName?: string;
  userEmail?: string;
  createdAt?: string;
};

export default function AdminFeedbackPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);

  const load = () => {
    axios
      .get<{ items: Row[]; total: number }>("/api/admin/feedback", {
        headers: adminAuthHeaders(),
        params: { page, limit: 20 },
      })
      .then(({ data }) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => toast({ title: "Failed to load reviews", variant: "destructive" }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const del = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
    try {
      await axios.delete(`/api/admin/feedback/${id}`, { headers: adminAuthHeaders() });
      toast({ title: "Review deleted" });
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Reviews</h1>
      <p className="text-zinc-500 text-sm mb-6">Delete only — users submit from the Feedback page.</p>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400 w-24">Rating</TableHead>
              <TableHead className="text-zinc-400">User</TableHead>
              <TableHead className="text-zinc-400">Message</TableHead>
              <TableHead className="text-zinc-400 w-20"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r._id} className="border-zinc-800 align-top">
                <TableCell>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    <Star className="w-4 h-4 fill-amber-400" />
                    {r.rating}
                  </div>
                </TableCell>
                <TableCell className="text-zinc-400 text-sm max-w-[180px]">
                  <div className="text-white">{r.userName || "—"}</div>
                  <div className="text-xs truncate">{r.userEmail}</div>
                </TableCell>
                <TableCell className="text-zinc-300 text-sm max-w-xl whitespace-pre-wrap">{r.message}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="text-red-400/80" onClick={() => setDeleteConfirm({ id: r._id })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-2 mt-4 text-sm text-zinc-500">
        <span>
          {total} total
          {total > 20 ? ` · Page ${page} of ${Math.ceil(total / 20) || 1}` : ""}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} className="border-zinc-700" onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 20 >= total}
            className="border-zinc-700"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete review?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This review will be permanently deleted. This cannot be undone.
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
