import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "outline",
  done: "default",
  failed: "destructive",
};

const AdminUrlQueue = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [minAttempts, setMinAttempts] = useState("");

  const { data: providerTypes } = useQuery({
    queryKey: ["provider_types"],
    queryFn: async () => {
      const { data } = await supabase.from("provider_types").select("*");
      return data ?? [];
    },
  });

  const { data: queueData, isLoading } = useQuery({
    queryKey: ["admin_url_queue", page, filterStatus, filterType, minAttempts],
    queryFn: async () => {
      let query = supabase
        .from("url_queue")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterType !== "all") query = query.eq("provider_type", filterType);
      if (minAttempts) query = query.gte("attempts", parseInt(minAttempts));

      const { data, count, error } = await query;
      if (error) throw error;
      return { items: data ?? [], total: count ?? 0 };
    },
  });

  const retryItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("url_queue").update({
        status: "pending",
        last_error: null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_url_queue"] });
      toast.success("Item reset to pending");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("url_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_url_queue"] });
      toast.success("Item deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPages = Math.ceil((queueData?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="font-semibold text-xl text-foreground">URL Queue</h1>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {providerTypes?.map((t) => (
                <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-8 text-xs w-32" type="number" placeholder="Min attempts" value={minAttempts} onChange={(e) => { setMinAttempts(e.target.value); setPage(0); }} />
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Attempts</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Provider</TableHead>
                <TableHead className="text-xs">URL</TableHead>
                <TableHead className="text-xs">Error</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs">Processed</TableHead>
                <TableHead className="text-xs w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : queueData?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">No items</TableCell>
                </TableRow>
              ) : (
                queueData?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={statusColors[item.status] ?? "secondary"} className="text-[10px]">{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-center">{item.attempts}</TableCell>
                    <TableCell className="text-xs">{item.provider_type ?? "—"}</TableCell>
                    <TableCell className="text-xs">{item.provider_name ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        {item.url.replace(/^https?:\/\//, "").slice(0, 40)}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[120px] truncate" title={item.last_error ?? ""}>
                      {item.last_error ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.processed_at ? new Date(item.processed_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => retryItem.mutate(item.id)} title="Retry">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete queue item?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove this URL from the queue.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteItem.mutate(item.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page + 1} of {totalPages} ({queueData?.total} total)</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-3 w-3" /> Prev
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUrlQueue;
