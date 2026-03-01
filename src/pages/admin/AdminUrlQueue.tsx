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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Play, Trash2, ExternalLink, ChevronLeft, ChevronRight, FileText, Eye } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "outline",
  done: "default",
  failed: "destructive",
};

const confidenceBadge = (score: number | null) => {
  if (score === null || score === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  if (pct < 50) variant = "destructive";
  else if (pct < 75) variant = "secondary";
  return <Badge variant={variant} className="text-[10px] font-mono">{pct}%</Badge>;
};

const AdminUrlQueue = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [minAttempts, setMinAttempts] = useState("");

  // Log viewer state
  const [logItem, setLogItem] = useState<{ url: string; error: string | null } | null>(null);

  // Screenshot viewer state
  const [screenshotItem, setScreenshotItem] = useState<{ url: string; screenshot_url: string } | null>(null);

  // Run agent state
  const [runningId, setRunningId] = useState<string | null>(null);

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

  const runAgent = async (id: string) => {
    setRunningId(id);
    try {
      // Reset to pending first so the agent picks it up
      const { error: resetErr } = await supabase.from("url_queue").update({
        status: "pending",
        last_error: null,
        next_run_at: null,
      } as any).eq("id", id);
      if (resetErr) throw resetErr;

      // Trigger the extraction agent with batch_size=1 to process immediately
      const { data, error } = await supabase.functions.invoke("process-url-queue", {
        body: {},
        headers: { "x-manual": "true" },
      });
      if (error) throw error;

      const processed = data?.processed ?? 0;
      toast.success(`Agent run complete: ${processed} URL(s) processed`);
      queryClient.invalidateQueries({ queryKey: ["admin_url_queue"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Agent run failed: ${msg}`);
    } finally {
      setRunningId(null);
    }
  };

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
                <TableHead className="text-xs">Confidence</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Provider</TableHead>
                <TableHead className="text-xs">URL</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs">Processed</TableHead>
                <TableHead className="text-xs w-32">Actions</TableHead>
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
                queueData?.items.map((item) => {
                  const conf = (item as any).confidence_score as number | null;
                  const screenshot = (item as any).screenshot_url as string | null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant={statusColors[item.status] ?? "secondary"} className="text-[10px]">{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center">{item.attempts}</TableCell>
                      <TableCell>{confidenceBadge(conf)}</TableCell>
                      <TableCell className="text-xs">{item.provider_type ?? "—"}</TableCell>
                      <TableCell className="text-xs">{item.provider_name ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          {item.url.replace(/^https?:\/\//, "").slice(0, 35)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.processed_at ? new Date(item.processed_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {/* Run Agent */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-primary"
                            disabled={runningId === item.id || item.status === "processing"}
                            onClick={() => runAgent(item.id)}
                            title="Run extraction agent on this URL"
                          >
                            <Play className={`h-3.5 w-3.5 ${runningId === item.id ? "animate-pulse" : ""}`} />
                          </Button>

                          {/* View Log */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 w-7 p-0 ${item.last_error ? "text-destructive" : "text-muted-foreground"}`}
                            onClick={() => setLogItem({ url: item.url, error: item.last_error })}
                            title="View agent log / error"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>

                          {/* Screenshot Preview */}
                          {screenshot && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground"
                              onClick={() => setScreenshotItem({ url: item.url, screenshot_url: screenshot })}
                              title="View agent screenshot"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Delete */}
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
                  );
                })
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

      {/* Log Viewer Modal */}
      <Dialog open={!!logItem} onOpenChange={(open) => !open && setLogItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Agent Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground truncate" title={logItem?.url}>
              {logItem?.url}
            </div>
            {logItem?.error ? (
              <pre className="bg-muted rounded-lg p-4 overflow-auto max-h-64 text-xs text-destructive whitespace-pre-wrap break-words">
                {logItem.error}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No errors recorded for this URL.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Screenshot Preview Modal */}
      <Dialog open={!!screenshotItem} onOpenChange={(open) => !open && setScreenshotItem(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Agent Screenshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground truncate" title={screenshotItem?.url}>
              {screenshotItem?.url}
            </div>
            <div className="rounded-lg border border-border overflow-hidden bg-muted">
              <img
                src={screenshotItem?.screenshot_url ?? ""}
                alt="Agent screenshot"
                className="w-full h-auto max-h-[70vh] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).alt = "Screenshot failed to load";
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUrlQueue;
