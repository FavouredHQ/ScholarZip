import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Zap, RefreshCw, AlertTriangle, Clock, Settings2, Play,
  Database, FileText, BarChart3, CheckCircle2,
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
};

type SettingsType = typeof DEFAULTS;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const AdminExtractionSettings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SettingsType>(DEFAULTS);
  const [enabled, setEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ time: string; data: Record<string, unknown> } | null>(null);

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
      });
      setDirty(false);
    }
  }, [agentRow]);

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

  const { data: stats } = useQuery({
    queryKey: ["extraction_health"],
    queryFn: async () => {
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [pending, processing, failedRecent, totalScholarships, recentScholarships, avgConf] = await Promise.all([
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "processing"),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", week),
        supabase.from("scholarships").select("*", { count: "exact", head: true }),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).gte("created_at", week),
        supabase.from("scholarships").select("confidence_score").not("confidence_score", "is", null).limit(1000),
      ]);
      const scores = (avgConf.data ?? []).map((r) => r.confidence_score as number).filter(Boolean);
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "—";
      return {
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        failed: failedRecent.count ?? 0,
        totalScholarships: totalScholarships.count ?? 0,
        recentScholarships: recentScholarships.count ?? 0,
        avgConfidence: avg,
      };
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
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-url-queue?force=true`,
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
      setLastRun({ time: new Date().toISOString(), data: result });
      toast.success("Extraction run completed");
      queryClient.invalidateQueries({ queryKey: ["extraction_health"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Extraction failed: ${msg}`);
      setLastRun({ time: new Date().toISOString(), data: { error: msg } });
    } finally {
      setRunning(false);
    }
  };

  const healthTiles = [
    { label: "Pending URLs", value: stats?.pending ?? "—", icon: Database, color: "text-primary" },
    { label: "Processing", value: stats?.processing ?? "—", icon: RefreshCw, color: "text-accent" },
    { label: "Failed (7d)", value: stats?.failed ?? "—", icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Scholarships", value: stats?.totalScholarships ?? "—", icon: FileText, color: "text-primary" },
    { label: "Added (7d)", value: stats?.recentScholarships ?? "—", icon: CheckCircle2, color: "text-primary" },
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
      <div className="space-y-6 max-w-4xl">
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

        {/* Health tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

        {/* Settings form */}
        <div className="grid md:grid-cols-2 gap-4">
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

          {/* Classifier */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Classifier &amp; Extraction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormToggle label="Use classifier" checked={settings.use_classifier} onChange={() => update("use_classifier", !settings.use_classifier)} />
              <FormNumber label="Classifier min confidence" value={settings.classifier_min_confidence} onChange={(v) => updateNum("classifier_min_confidence", v, 0, 1)} />
              <FormNumber label="Extraction min confidence" value={settings.extraction_min_confidence} onChange={(v) => updateNum("extraction_min_confidence", v, 0, 1)} />
              <div className="space-y-1">
                <Label className="text-xs">Default currency</Label>
                <Input className="h-8 text-sm" value={settings.default_currency} onChange={(e) => update("default_currency", e.target.value)} />
              </div>
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
                <Input className="h-8 text-sm" value={settings.firecrawl_format} onChange={(e) => update("firecrawl_format", e.target.value)} />
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

        {/* Run Now */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4 text-primary" /> Manual Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Trigger the extraction agent immediately with force=true (ignores next_run_at). Save settings first if changed.
            </p>
            <Button
              size="sm"
              className="gradient-gold text-accent-foreground font-semibold"
              disabled={running}
              onClick={runExtraction}
            >
              {running ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running…</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Run Extraction Now</>}
            </Button>

            {lastRun && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Last manual run: {new Date(lastRun.time).toLocaleString()}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <MiniStat label="Selected" value={lastRun.data.selected} />
                  <MiniStat label="Processed" value={lastRun.data.processed} />
                  <MiniStat label="Upserted" value={lastRun.data.inserted_or_updated} />
                  <MiniStat label="Not Scholarship" value={lastRun.data.ignored_not_scholarship} />
                  <MiniStat label="Failed" value={lastRun.data.failed} />
                  <MiniStat label="Retried" value={lastRun.data.retried} />
                  <MiniStat label="Runtime" value={lastRun.data.runtime_ms ? `${lastRun.data.runtime_ms}ms` : "—"} />
                </div>
                {lastRun.data.last_error && (
                  <p className="text-xs text-destructive">Last error: {String(lastRun.data.last_error)}</p>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Full JSON</summary>
                  <pre className="bg-muted rounded-lg p-3 overflow-auto max-h-48 mt-1 text-foreground">
                    {JSON.stringify(lastRun.data, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

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

const MiniStat = ({ label, value }: { label: string; value: unknown }) => (
  <div className="bg-muted rounded-md px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold text-foreground">{value != null ? String(value) : "—"}</div>
  </div>
);

export default AdminExtractionSettings;
