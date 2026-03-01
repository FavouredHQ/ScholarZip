import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, ExternalLink, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useCountries } from "@/hooks/useCountries";

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  Hook: provider types + subtypes from DB                           */
/* ------------------------------------------------------------------ */
const useProviderLookups = () => {
  const { data: providerTypes } = useQuery({
    queryKey: ["provider_types"],
    queryFn: async () => {
      const { data } = await supabase.from("provider_types").select("*");
      return data ?? [];
    },
  });

  const { data: providerSubtypes } = useQuery({
    queryKey: ["provider_subtypes"],
    queryFn: async () => {
      const { data } = await supabase.from("provider_subtypes").select("*");
      return data ?? [];
    },
  });

  const subtypesFor = (parentType: string) =>
    (providerSubtypes ?? []).filter((s) => s.parent_type === parentType);

  return { providerTypes: providerTypes ?? [], providerSubtypes: providerSubtypes ?? [], subtypesFor };
};

/* ------------------------------------------------------------------ */
/*  Subtype Select (reused in edit + bulk)                            */
/* ------------------------------------------------------------------ */
const SubtypeSelect = ({
  providerType,
  value,
  onChange,
  subtypesFor,
  required,
}: {
  providerType: string;
  value: string;
  onChange: (v: string) => void;
  subtypesFor: (t: string) => { code: string; label: string }[];
  required?: boolean;
}) => {
  const options = subtypesFor(providerType);
  if (!providerType || options.length === 0) return null;

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        Subtype {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select subtype..." />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {!required && <SelectItem value="__none__">None</SelectItem>}
          {options.map((s) => (
            <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
const AdminSourceHubs = () => {
  const queryClient = useQueryClient();
  const { countries } = useCountries();
  const { providerTypes, subtypesFor } = useProviderLookups();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Edit state
  const [editHub, setEditHub] = useState<Tables<"source_hubs"> | null>(null);
  const [editForm, setEditForm] = useState({ provider_name: "", provider_type: "", provider_subtype: "", country: "", hub_url: "", is_active: true });

  // Bulk add state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [bulkSubtype, setBulkSubtype] = useState("");
  const [bulkName, setBulkName] = useState("");
  const [bulkCountry, setBulkCountry] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Rerun state
  const [rerunningId, setRerunningId] = useState<string | null>(null);
  const [rerunResult, setRerunResult] = useState<{ hubId: string; data: Record<string, unknown> } | null>(null);

  const RERUN_STATUSES = ["failed", "depth_exceeded", "queued_or_limited"];

  const rerunHub = async (hubId: string) => {
    setRerunningId(hubId);
    setRerunResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("rerun-single-hub", { body: { hub_id: hubId } });
      if (error) throw error;
      const queued = data?.urls_queued ?? 0;
      toast.success(`Hub re-run complete: ${queued} URLs queued`);
      setRerunResult({ hubId, data: data ?? {} });
      queryClient.invalidateQueries({ queryKey: ["admin_source_hubs"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Re-run failed: ${msg}`);
    } finally {
      setRerunningId(null);
    }
  };

  const { data: hubsData, isLoading } = useQuery({
    queryKey: ["admin_source_hubs", page, search, filterType, filterActive, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("source_hubs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) query = query.or(`provider_name.ilike.%${search}%,hub_url.ilike.%${search}%`);
      if (filterType !== "all") query = query.eq("provider_type", filterType);
      if (filterActive === "active") query = query.eq("is_active", true);
      if (filterActive === "inactive") query = query.eq("is_active", false);
      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      const { data, count, error } = await query;
      if (error) throw error;
      return { hubs: data ?? [], total: count ?? 0 };
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("source_hubs").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_source_hubs"] }); toast.success("Hub updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateHub = useMutation({
    mutationFn: async (hub: { id: string; provider_name: string | null; provider_type: string | null; provider_subtype: string | null; country: string | null; hub_url: string; is_active: boolean }) => {
      const { error } = await supabase.from("source_hubs").update({
        provider_name: hub.provider_name || null,
        provider_type: hub.provider_type || null,
        provider_subtype: hub.provider_subtype || null,
        country: hub.country || null,
        hub_url: hub.hub_url,
        is_active: hub.is_active,
      }).eq("id", hub.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_source_hubs"] }); setEditHub(null); toast.success("Hub updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEditOpen = (hub: Tables<"source_hubs">) => {
    setEditHub(hub);
    setEditForm({
      provider_name: hub.provider_name ?? "",
      provider_type: hub.provider_type ?? "",
      provider_subtype: (hub as any).provider_subtype ?? "",
      country: hub.country ?? "",
      hub_url: hub.hub_url,
      is_active: hub.is_active,
    });
  };

  const isExternalAgency = (type: string) => type === "External Agency";

  const handleBulkAdd = async () => {
    if (isExternalAgency(bulkType) && !bulkSubtype) {
      toast.error("Subtype is required for External Agency");
      return;
    }
    setBulkSubmitting(true);
    const urls = bulkUrls.split("\n").map((u) => u.trim()).filter((u) => u.length > 0);
    if (urls.length === 0) { toast.error("No URLs provided"); setBulkSubmitting(false); return; }

    const { data: existing } = await supabase.from("source_hubs").select("hub_url");
    const existingSet = new Set((existing ?? []).map((h) => h.hub_url));
    const newUrls = [...new Set(urls)].filter((u) => !existingSet.has(u));
    const skipped = urls.length - newUrls.length;

    if (newUrls.length > 0) {
      const rows = newUrls.map((url) => ({
        hub_url: url,
        provider_type: bulkType || null,
        provider_subtype: bulkSubtype && bulkSubtype !== "__none__" ? bulkSubtype : null,
        provider_name: bulkName || null,
        country: bulkCountry || null,
        is_active: true,
      }));
      const { error } = await supabase.from("source_hubs").insert(rows);
      if (error) { toast.error(error.message); setBulkSubmitting(false); return; }
    }

    toast.success(`Added ${newUrls.length}, skipped ${skipped} duplicates`);
    setBulkOpen(false);
    setBulkUrls(""); setBulkType(""); setBulkSubtype(""); setBulkName(""); setBulkCountry("");
    setBulkSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["admin_source_hubs"] });
  };

  const handleEditSave = () => {
    if (!editHub) return;
    if (isExternalAgency(editForm.provider_type) && !editForm.provider_subtype) {
      toast.error("Subtype is required for External Agency");
      return;
    }
    updateHub.mutate({
      id: editHub.id,
      provider_name: editForm.provider_name || null,
      provider_type: editForm.provider_type || null,
      provider_subtype: editForm.provider_subtype && editForm.provider_subtype !== "__none__" ? editForm.provider_subtype : null,
      country: editForm.country || null,
      hub_url: editForm.hub_url,
      is_active: editForm.is_active,
    });
  };

  const totalPages = Math.ceil((hubsData?.total ?? 0) / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-xl text-foreground">Source Hubs</h1>
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-gold text-accent-foreground font-semibold gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Bulk Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Bulk Add Hubs</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Hub URLs (one per line)</Label>
                  <Textarea rows={8} value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} placeholder={"https://example.com/scholarships\nhttps://..."} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Provider Type</Label>
                    <Select value={bulkType} onValueChange={(v) => { setBulkType(v); setBulkSubtype(""); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {providerTypes.map((t) => (
                          <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <SubtypeSelect
                    providerType={bulkType}
                    value={bulkSubtype}
                    onChange={setBulkSubtype}
                    subtypesFor={subtypesFor}
                    required={isExternalAgency(bulkType)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Provider Name</Label>
                    <Input className="h-8 text-xs" value={bulkName} onChange={(e) => setBulkName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Country</Label>
                    <Select value={bulkCountry} onValueChange={setBulkCountry}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAdd} disabled={bulkSubmitting} className="gradient-gold text-accent-foreground font-semibold">
                  {bulkSubmitting ? "Adding..." : "Add Hubs"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Input className="h-8 text-xs w-64" placeholder="Search provider name or URL..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Provider Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {providerTypes.map((t) => (
                <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterActive} onValueChange={(v) => { setFilterActive(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="depth_exceeded">Depth Exceeded</SelectItem>
              <SelectItem value="queued_or_limited">Rate Limited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Subtype</TableHead>
                <TableHead className="text-xs">Provider</TableHead>
                <TableHead className="text-xs">Country</TableHead>
                <TableHead className="text-xs">URL</TableHead>
                <TableHead className="text-xs">Active</TableHead>
                <TableHead className="text-xs">Last Crawled</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Error</TableHead>
                <TableHead className="text-xs w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : hubsData?.hubs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">No hubs found</TableCell>
                </TableRow>
              ) : (
                hubsData?.hubs.map((hub) => (
                  <TableRow key={hub.id}>
                    <TableCell className="text-xs">{hub.provider_type ?? "—"}</TableCell>
                    <TableCell className="text-xs">{(hub as any).provider_subtype ?? "—"}</TableCell>
                    <TableCell className="text-xs font-medium">{hub.provider_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{hub.country ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      <a href={hub.hub_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        {hub.hub_url.replace(/^https?:\/\//, "").slice(0, 40)}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Switch checked={hub.is_active} onCheckedChange={(checked) => toggleActive.mutate({ id: hub.id, is_active: checked })} className="scale-75" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {hub.last_crawled_at ? new Date(hub.last_crawled_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {hub.status ? (
                        <Badge variant={hub.status === "ok" ? "default" : "destructive"} className="text-[10px]">{hub.status}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[120px] truncate" title={hub.error ?? ""}>{hub.error ?? "—"}</TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditOpen(hub)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {RERUN_STATUSES.includes(hub.status ?? "") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-primary"
                          disabled={rerunningId === hub.id}
                          onClick={() => rerunHub(hub.id)}
                          title="Re-run this hub"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${rerunningId === hub.id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page + 1} of {totalPages} ({hubsData?.total} total)</span>
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

      {/* Edit Dialog */}
      <Dialog open={!!editHub} onOpenChange={(open) => !open && setEditHub(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Hub</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Hub URL</Label>
              <Input className="h-8 text-xs" value={editForm.hub_url} onChange={(e) => setEditForm({ ...editForm, hub_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Provider Type</Label>
                <Select value={editForm.provider_type} onValueChange={(v) => setEditForm({ ...editForm, provider_type: v, provider_subtype: "" })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {providerTypes.map((t) => (
                      <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SubtypeSelect
                providerType={editForm.provider_type}
                value={editForm.provider_subtype}
                onChange={(v) => setEditForm({ ...editForm, provider_subtype: v })}
                subtypesFor={subtypesFor}
                required={isExternalAgency(editForm.provider_type)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Provider Name</Label>
                <Input className="h-8 text-xs" value={editForm.provider_name} onChange={(e) => setEditForm({ ...editForm, provider_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Country</Label>
                <Select value={editForm.country} onValueChange={(v) => setEditForm({ ...editForm, country: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editForm.is_active} onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })} />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editHub && RERUN_STATUSES.includes(editHub.status ?? "") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={rerunningId === editHub.id}
                onClick={() => rerunHub(editHub.id)}
              >
                <RotateCw className={`h-3.5 w-3.5 ${rerunningId === editHub.id ? "animate-spin" : ""}`} />
                {rerunningId === editHub.id ? "Running…" : "Re-run Hub"}
              </Button>
            )}
            <Button onClick={handleEditSave} className="gradient-gold text-accent-foreground font-semibold">Save</Button>
          </DialogFooter>
          {rerunResult && rerunResult.hubId === editHub?.id && (
            <details className="text-xs mt-2">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Last re-run result</summary>
              <pre className="bg-muted rounded-lg p-3 overflow-auto max-h-32 mt-1 text-foreground">
                {JSON.stringify(rerunResult.data, null, 2)}
              </pre>
            </details>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSourceHubs;
