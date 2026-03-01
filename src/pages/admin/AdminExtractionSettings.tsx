import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Zap, RefreshCw, AlertTriangle, Clock, Settings2, Play,
  Database, FileText, BarChart3, CheckCircle2, ExternalLink, RotateCcw, Filter,
} from "lucide-react";
import { toast } from "sonner";

const AGENT_NAME = "process_url_queue";

const DEFAULTS = {
  batch_size: 3,
  max_attempts: 3,
  lock_minutes: 20,
  min_text_length: 500,
  use_classifier: true,
  classifier_min_confidence: 0.6,
  extraction_min_confidence: 0.6,
  default_currency: "USD",
  backoff_minutes_base: 10,
  backoff_minutes_max: 1440,
  firecrawl_format: "markdown",
  firecrawl_timeout_ms: 60000,
  max_new_urls_from_list: 50,
  same_domain_only: true,
  ignore_query_urls: true,
};

type SettingsType = typeof DEFAULTS;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ── Sub-components ──
const FormNumber = ({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <Input type="number" step="any" className="h-8 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const FormToggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
  <div className="flex items-center justify-between">
    <Label className="text-xs">{label}</Label>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const FormSlider = ({ label, value, onChange, min = 0, max = 1, step = 0.05 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs font-mono text-muted-foreground">{value.toFixed(2)}</span>
    </div>
    <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} className="py-1" />
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: unknown }) => (
  <div className="bg-muted rounded-md px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold text-foreground">{value != null ? String(value) : "—"}</div>
  </div>
);

const statusColor = (s: string) => {
  switch (s) {
    case "pending": return "bg-accent/20 text-accent-foreground";
    case "processing": return "bg-primary/20 text-primary";
    case "done": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "failed": return "bg-destructive/20 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
};

const AdminExtractionSettings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SettingsType>(DEFAULTS);
  const [enabled, setEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [batchOverride, setBatchOverride] = useState("");
  const [lastRunResult, setLastRunResult] = useState<Record<string, unknown> | null>(null);

  // Drilldown filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterError, setFilterError] = useState("");

  // ── Load agent settings ──
  const { data: agentRow, isLoading } = useQuery({
    queryKey: ["agent_settings", AGENT_NAME],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_settings")
        .select("*")
        .eq("agent_name", AGENT_NAME)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (agentRow) {
      setEnabled(agentRow.enabled ?? true);
      const s = (agentRow.settings ?? {}) as Record<string, unknown>;
      setSettings({
        batch_size: (s.batch_size as number) ?? DEFAULTS.batch_size,
        max_attempts: (s.max_attempts as number) ?? DEFAULTS.max_attempts,
        lock_minutes: (s.lock_minutes as number) ?? DEFAULTS.lock_minutes,
        min_text_length: (s.min_text_length as number) ?? DEFAULTS.min_text_length,
        use_classifier: (s.use_classifier as boolean) ?? DEFAULTS.use_classifier,
        classifier_min_confidence: (s.classifier_min_confidence as number) ?? DEFAULTS.classifier_min_confidence,
        extraction_min_confidence: (s.extraction_min_confidence as number) ?? DEFAULTS.extraction_min_confidence,
        default_currency: (s.default_currency as string) ?? DEFAULTS.default_currency,
        backoff_minutes_base: (s.backoff_minutes_base as number) ?? DEFAULTS.backoff_minutes_base,
        backoff_minutes_max: (s.backoff_minutes_max as number) ?? DEFAULTS.backoff_minutes_max,
        firecrawl_format: (s.firecrawl_format as string) ?? DEFAULTS.firecrawl_format,
        firecrawl_timeout_ms: (s.firecrawl_timeout_ms as number) ?? DEFAULTS.firecrawl_timeout_ms,
        max_new_urls_from_list: (s.max_new_urls_from_list as number) ?? DEFAULTS.max_new_urls_from_list,
        same_domain_only: (s.same_domain_only as boolean) ?? DEFAULTS.same_domain_only,
        ignore_query_urls: (s.ignore_query_urls as boolean) ?? DEFAULTS.ignore_query_urls,
      });
      setDirty(false);
    }
  }, [agentRow]);

  // ── Save settings ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        agent_name: AGENT_NAME,
        enabled,
        settings: settings as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("agent_settings")
        .upsert(payload as any, { onConflict: "agent_name" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["agent_settings", AGENT_NAME] });
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  // ── Health stats ──
  const { data: stats } = useQuery({
    queryKey: ["extraction_health"],
    queryFn: async () => {
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [pending, processing, failedRecent, doneRecent, totalScholarships, recentScholarships, verifiedRecent, avgConf] = await Promise.all([
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "processing"),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", week),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "done").gte("processed_at", day),
        supabase.from("scholarships").select("*", { count: "exact", head: true }),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).gte("created_at", week),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).not("last_verified_at", "is", null).gte("last_verified_at", week),
        supabase.from("scholarships").select("confidence_score").not("confidence_score", "is", null).limit(1000),
      ]);
      const scores = (avgConf.data ?? []).map((r) => r.confidence_score as number).filter(Boolean);
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "—";
      return {
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        failed: failedRecent.count ?? 0,
        done24h: doneRecent.count ?? 0,
        totalScholarships: totalScholarships.count ?? 0,
        recentScholarships: recentScholarships.count ?? 0,
        verifiedRecent: verifiedRecent.count ?? 0,
        avgConfidence: avg,
      };
    },
    refetchInterval: 30000,
  });

  // ── Run logs ──
  const { data: runLogs } = useQuery({
    queryKey: ["agent_run_logs", AGENT_NAME],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_run_logs" as any)
        .select("*")
        .eq("agent_name", AGENT_NAME)
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  // ── Drilldown: recent url_queue rows ──
  const { data: queueRows } = useQuery({
    queryKey: ["extraction_drilldown", filterStatus, filterError],
    queryFn: async () => {
      const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      let q = supabase
        .from("url_queue")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      if (filterError) q = q.ilike("last_error", `%${filterError}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const update = <K extends keyof SettingsType>(key: K, val: SettingsType[K]) => {
    setSettings((p) => ({ ...p, [key]: val }));
    setDirty(true);
  };

  const updateNum = (key: keyof SettingsType, val: string, min: number, max: number) => {
    const n = parseFloat(val);
    if (!isNaN(n)) update(key, clamp(n, min, max) as SettingsType[typeof key]);
  };

  const runExtraction = async () => {
    setRunning(true);
    try {
      const params = new URLSearchParams({ manual: "true", force: "true" });
      if (batchOverride && parseInt(batchOverride) > 0) params.set("batch_size", batchOverride);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-url-queue?${params}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unknown error");
      setLastRunResult(result);
      toast.success("Extraction run completed");
      queryClient.invalidateQueries({ queryKey: ["extraction_health"] });
      queryClient.invalidateQueries({ queryKey: ["agent_run_logs", AGENT_NAME] });
      queryClient.invalidateQueries({ queryKey: ["extraction_drilldown"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Extraction failed: ${msg}`);
      setLastRunResult({ error: msg });
    } finally {
      setRunning(false);
    }
  };

  const retryRow = async (row: any) => {
    const { error } = await supabase.from("url_queue").update({
      status: "pending",
      next_run_at: null,
      last_error: null,
      attempts: (row.attempts ?? 0),
    }).eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Queued for retry");
      queryClient.invalidateQueries({ queryKey: ["extraction_drilldown"] });
    }
  };

  const healthTiles = [
    { label: "Pending URLs", value: stats?.pending ?? "—", icon: Database, color: "text-primary" },
    { label: "Processing", value: stats?.processing ?? "—", icon: RefreshCw, color: "text-accent-foreground" },
    { label: "Done (24h)", value: stats?.done24h ?? "—", icon: CheckCircle2, color: "text-primary" },
    { label: "Failed (7d)", value: stats?.failed ?? "—", icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Scholarships", value: stats?.totalScholarships ?? "—", icon: FileText, color: "text-primary" },
    { label: "Added (7d)", value: stats?.recentScholarships ?? "—", icon: CheckCircle2, color: "text-primary" },
    { label: "Verified (7d)", value: stats?.verifiedRecent ?? "—", icon: CheckCircle2, color: "text-primary" },
    { label: "Avg Confidence", value: stats?.avgConfidence ?? "—", icon: BarChart3, color: "text-muted-foreground" },
  ];

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading settings…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-xl text-foreground flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Agent 2: Extraction Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how process_url_queue scrapes pages, classifies, and extracts scholarships.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled-toggle" className="text-sm font-medium">Enabled</Label>
            <Switch
              id="enabled-toggle"
              checked={enabled}
              onCheckedChange={(v) => { setEnabled(v); setDirty(true); }}
            />
          </div>
        </div>

        {agentRow?.updated_at && (
          <p className="text-xs text-muted-foreground">Last updated: {new Date(agentRow.updated_at).toLocaleString()}</p>
        )}

        {/* A) Health tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {healthTiles.map((t) => (
            <Card key={t.label} className="shadow-card">
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <t.icon className={`h-3.5 w-3.5 ${t.color}`} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.label}</span>
                </div>
                <span className="text-lg font-bold text-foreground">{t.value}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* B) Settings form */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Core */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Core Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormNumber label="Batch size" value={settings.batch_size} onChange={(v) => updateNum("batch_size", v, 1, 20)} />
              <FormNumber label="Max attempts" value={settings.max_attempts} onChange={(v) => updateNum("max_attempts", v, 1, 10)} />
              <FormNumber label="Lock duration (min)" value={settings.lock_minutes} onChange={(v) => updateNum("lock_minutes", v, 5, 120)} />
              <FormNumber label="Min text length" value={settings.min_text_length} onChange={(v) => updateNum("min_text_length", v, 50, 5000)} />
            </CardContent>
          </Card>

          {/* Classifier & Extraction */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Classifier &amp; Extraction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormToggle label="Use classifier" checked={settings.use_classifier} onChange={() => update("use_classifier", !settings.use_classifier)} />
              <FormSlider label="Classifier min confidence" value={settings.classifier_min_confidence} onChange={(v) => update("classifier_min_confidence", v)} />
              <FormSlider label="Extraction min confidence" value={settings.extraction_min_confidence} onChange={(v) => update("extraction_min_confidence", v)} />
              <div className="space-y-1">
                <Label className="text-xs">Default currency</Label>
                <Input className="h-8 text-sm" value={settings.default_currency} onChange={(e) => update("default_currency", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* List Discovery */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> List Discovery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormNumber label="Max new URLs from list" value={settings.max_new_urls_from_list} onChange={(v) => updateNum("max_new_urls_from_list", v, 1, 200)} />
              <FormToggle label="Same domain only" checked={settings.same_domain_only} onChange={() => update("same_domain_only", !settings.same_domain_only)} />
              <FormToggle label="Ignore query URLs" checked={settings.ignore_query_urls} onChange={() => update("ignore_query_urls", !settings.ignore_query_urls)} />
            </CardContent>
          </Card>

          {/* Backoff */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Backoff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormNumber label="Backoff base (min)" value={settings.backoff_minutes_base} onChange={(v) => updateNum("backoff_minutes_base", v, 1, 120)} />
              <FormNumber label="Backoff max (min)" value={settings.backoff_minutes_max} onChange={(v) => updateNum("backoff_minutes_max", v, 10, 10080)} />
            </CardContent>
          </Card>

          {/* Firecrawl */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Firecrawl</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Format</Label>
                <Select value={settings.firecrawl_format} onValueChange={(v) => update("firecrawl_format", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">markdown</SelectItem>
                    <SelectItem value="html">html</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormNumber label="Timeout (ms)" value={settings.firecrawl_timeout_ms} onChange={(v) => updateNum("firecrawl_timeout_ms", v, 5000, 300000)} />
            </CardContent>
          </Card>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button
            className="gradient-gold text-accent-foreground font-semibold"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save Settings"}
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        </div>

        <Separator />

        {/* C) Manual Run */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4 text-primary" /> Manual Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Trigger the extraction agent immediately with force=true. Save settings first if changed.
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="gradient-gold text-accent-foreground font-semibold"
                disabled={running}
                onClick={runExtraction}
              >
                {running ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running…</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Run Extraction Now</>}
              </Button>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs whitespace-nowrap">Batch override</Label>
                <Input
                  type="number"
                  className="h-8 w-20 text-sm"
                  placeholder="—"
                  value={batchOverride}
                  onChange={(e) => setBatchOverride(e.target.value)}
                />
              </div>
            </div>

            {lastRunResult && (
              <div className="mt-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <MiniStat label="Selected" value={lastRunResult.selected} />
                  <MiniStat label="Processed" value={lastRunResult.processed} />
                  <MiniStat label="Upserted" value={lastRunResult.inserted_or_updated} />
                  <MiniStat label="List Pages" value={lastRunResult.list_pages_handled} />
                  <MiniStat label="New URLs Queued" value={lastRunResult.new_urls_queued_from_lists} />
                  <MiniStat label="Not Relevant" value={lastRunResult.ignored_not_relevant} />
                  <MiniStat label="Content Short" value={lastRunResult.content_too_short_count} />
                  <MiniStat label="Failed" value={lastRunResult.failed} />
                  <MiniStat label="Retried" value={lastRunResult.retried} />
                  <MiniStat label="Runtime" value={lastRunResult.runtime_ms ? `${lastRunResult.runtime_ms}ms` : "—"} />
                </div>
                {lastRunResult.last_error && (
                  <p className="text-xs text-destructive">Last error: {String(lastRunResult.last_error)}</p>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Full JSON</summary>
                  <pre className="bg-muted rounded-lg p-3 overflow-auto max-h-48 mt-1 text-foreground">
                    {JSON.stringify(lastRunResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* D) Last Run Logs */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Recent Run History</CardTitle>
          </CardHeader>
          <CardContent>
            {runLogs && runLogs.length > 0 ? (
              <div className="space-y-3">
                {runLogs.map((log: any) => {
                  const summary = log.summary as Record<string, unknown> | null;
                  return (
                    <div key={log.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant={log.status === "success" ? "default" : log.status === "error" ? "destructive" : "secondary"} className="text-xs">
                          {log.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{log.run_type}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(log.started_at).toLocaleString()}</span>
                        {log.duration_ms != null && <span className="text-xs text-muted-foreground">{log.duration_ms}ms</span>}
                      </div>
                      {summary && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
                          <MiniStat label="Processed" value={summary.processed} />
                          <MiniStat label="Upserted" value={summary.inserted_or_updated} />
                          <MiniStat label="Lists" value={summary.list_pages_handled} />
                          <MiniStat label="Queued" value={summary.new_urls_queued_from_lists} />
                          <MiniStat label="Failed" value={summary.failed} />
                        </div>
                      )}
                      {log.error && <p className="text-xs text-destructive">{log.error}</p>}
                      {summary && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Full JSON</summary>
                          <pre className="bg-muted rounded-lg p-3 overflow-auto max-h-32 mt-1 text-foreground">
                            {JSON.stringify(summary, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No run logs yet.</p>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* E) Pipeline Drilldown */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> URL Queue Drilldown (72h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Error contains</Label>
                <Input className="h-8 w-40 text-xs" placeholder="e.g. content_too_short" value={filterError} onChange={(e) => setFilterError(e.target.value)} />
              </div>
            </div>

            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">URL</TableHead>
                    <TableHead className="text-xs">Attempts</TableHead>
                    <TableHead className="text-xs">Last Error</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="text-xs">Processed</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueRows && queueRows.length > 0 ? queueRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${statusColor(row.status)}`}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-xs">
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          {row.url.replace(/^https?:\/\//, "").slice(0, 60)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs">{row.attempts}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={row.last_error || ""}>
                        {row.last_error ? row.last_error.slice(0, 80) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{row.processed_at ? new Date(row.processed_at).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(row.status === "failed" || row.status === "done") && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => retryRow(row)}>
                              <RotateCcw className="h-3 w-3" /> Retry
                            </Button>
                          )}
                          <a href={row.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                              <ExternalLink className="h-3 w-3" /> Open
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No queue rows in the last 72 hours.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminExtractionSettings;
