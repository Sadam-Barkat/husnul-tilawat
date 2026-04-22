import { useEffect, useState } from "react";
import axios from "axios";
import { adminAuthHeaders } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Row = {
  _id: string;
  recognizedText: string;
  referenceText?: string;
  user?: { name?: string; email?: string };
  lesson?: { title?: string };
  phrase?: { label?: string };
  createdAt?: string;
};

export default function AdminRecitationsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    axios
      .get<{ items: Row[]; total: number }>("/api/admin/recitations", {
        headers: adminAuthHeaders(),
        params: { page, limit: 25 },
      })
      .then(({ data }) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => toast({ title: "Failed to load recitations", variant: "destructive" }));
  }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Recitations</h1>
      <p className="text-zinc-500 text-sm mb-6">Read-only log of pronunciation attempts.</p>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">User</TableHead>
              <TableHead className="text-zinc-400">Reference</TableHead>
              <TableHead className="text-zinc-400">Recognized</TableHead>
              <TableHead className="text-zinc-400">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r._id} className="border-zinc-800 align-top">
                <TableCell className="text-sm text-zinc-300">
                  <div>{r.user?.name || "—"}</div>
                  <div className="text-xs text-zinc-500">{r.user?.email}</div>
                </TableCell>
                <TableCell className="text-sm text-zinc-400 max-w-[200px] font-arabic" dir="rtl">
                  {r.referenceText || r.lesson?.title || r.phrase?.label || "—"}
                </TableCell>
                <TableCell className="text-sm text-amber-100/90 font-arabic max-w-[200px]" dir="rtl">
                  {r.recognizedText}
                </TableCell>
                <TableCell className="text-xs text-zinc-500 whitespace-nowrap">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-2 mt-4 text-sm text-zinc-500">
        <span>
          {total} total
          {total > 25 ? ` · Page ${page} of ${Math.ceil(total / 25) || 1}` : ""}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} className="border-zinc-700" onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page * 25 >= total} className="border-zinc-700" onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
