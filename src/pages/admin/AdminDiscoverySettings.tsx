import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Globe, Database, Zap, RefreshCw, AlertTriangle, Clock,
  Settings2, Play, BarChart3, Shield, Info, Brain, X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const AGENT_NAME = "discover_from_hubs";

const DEFAULTS = {
  hubs_per_run: 5,
  hub_cooldown_hours: 24,
  firecrawl_maxDepth: 1,
  firecrawl_maxPages: 50,
  parallel_hubs: 2,
  same_domain_only: true,
  ignore_query_urls: true,
  allow_pdfs: true,
  ai_pdf_ocr: false,
  max_urls_to_queue_per_hub: 100,
  max_total_urls_to_queue_per_run: 500,
  stop_on_limit: true,
  lock_minutes: 20,
  backoff_minutes: 60,
  general_backoff_minutes: 240,
  depth_backoff_minutes: 1440,
  ai_link_filtering: false,
  priority_keywords: ["International", "STEM", "Merit", "Need-based"] as string[],
  use_vision_js_menus: false,
};

type SettingsType = typeof DEFAULTS;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const AdminDiscoverySettings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SettingsType>(DEFAULTS);
  const [enabled, setEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<{ time: string; data: Record<string, unknown> } | null>(null);
  const [keywordInput, setKeywordInput] = useState("");

  // Load settings
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
        hubs_per_run: (s.hubs_per_run as number) ?? DEFAULTS.hubs_per_run,
        hub_cooldown_hours: (s.hub_cooldown_hours as number) ?? DEFAULTS.hub_cooldown_hours,
        firecrawl_maxDepth: (s.firecrawl_maxDepth as number) ?? DEFAULTS.firecrawl_maxDepth,
        firecrawl_maxPages: (s.firecrawl_maxPages as number) ?? DEFAULTS.firecrawl_maxPages,
        parallel_hubs: (s.parallel_hubs as number) ?? DEFAULTS.parallel_hubs,
        same_domain_only: (s.same_domain_only as boolean) ?? DEFAULTS.same_domain_only,
        ignore_query_urls: (s.ignore_query_urls as boolean) ?? DEFAULTS.ignore_query_urls,
        allow_pdfs: (s.allow_pdfs as boolean) ?? DEFAULTS.allow_pdfs,
        ai_pdf_ocr: (s.ai_pdf_ocr as boolean) ?? DEFAULTS.ai_pdf_ocr,
        max_urls_to_queue_per_hub: (s.max_urls_to_queue_per_hub as number) ?? DEFAULTS.max_urls_to_queue_per_hub,
        max_total_urls_to_queue_per_run: (s.max_total_urls_to_queue_per_run as number) ?? DEFAULTS.max_total_urls_to_queue_per_run,
        stop_on_limit: (s.stop_on_limit as boolean) ?? DEFAULTS.stop_on_limit,
        lock_minutes: (s.lock_minutes as number) ?? DEFAULTS.lock_minutes,
        backoff_minutes: (s.backoff_minutes as number) ?? DEFAULTS.backoff_minutes,
        general_backoff_minutes: (s.general_backoff_minutes as number) ?? DEFAULTS.general_backoff_minutes,
        depth_backoff_minutes: (s.depth_backoff_minutes as number) ?? DEFAULTS.depth_backoff_minutes,
        ai_link_filtering: (s.ai_link_filtering as boolean) ?? DEFAULTS.ai_link_filtering,
        priority_keywords: (s.priority_keywords as string[]) ?? DEFAULTS.priority_keywords,
        use_vision_js_menus: (s.use_vision_js_menus as boolean) ?? DEFAULTS.use_vision_js_menus,
      });
      setDirty(false);
    }
  }, [agentRow]);

  // Save mutation
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

  // Health stats + success rate
  const { data: stats } = useQuery({
    queryKey: ["discovery_health"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [activeHubs, needsCrawl, pending, failed, lastCrawl, okHubs, totalCrawled] = await Promise.all([
        supabase.from("source_hubs").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("source_hubs").select("*", { count: "exact", head: true }).eq("is_active", true).or(`next_crawl_at.is.null,next_crawl_at.lte.${nowIso}`),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", week),
        supabase.from("source_hubs").select("last_crawled_at").order("last_crawled_at", { ascending: false, nullsFirst: false }).limit(1),
        supabase.from("source_hubs").select("*", { count: "exact", head: true }).or("status.eq.ok,status.eq.ok_fallback_single_page"),
        supabase.from("source_hubs").select("*", { count: "exact", head: true }).not("status", "is", null),
      ]);
      const ok = okHubs.count ?? 0;
      const total = totalCrawled.count ?? 0;
      const successRate = total > 0 ? Math.round((ok / total) * 100) : null;
      return {
        activeHubs: activeHubs.count ?? 0,
        needsCrawl: needsCrawl.count ?? 0,
        pending: pending.count ?? 0,
        failed: failed.count ?? 0,
        lastCrawl: lastCrawl.data?.[0]?.last_crawled_at ?? null,
        successRate,
      };
    },
    refetchInterval: 30000,
  });

  const update = <K extends keyof SettingsType>(key: K, val: SettingsType[K]) => {
    setSettings((p) => ({ ...p, [key]: val }));
    setDirty(true);
  };

  const updateNum = (key: keyof SettingsType, val: string, min: number, max: number) => {
    const n = parseInt(val, 10);
    if (!isNaN(n)) update(key, clamp(n, min, max) as SettingsType[typeof key]);
  };

  const toggleField = (key: keyof SettingsType) => {
    update(key, !settings[key] as SettingsType[typeof key]);
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !settings.priority_keywords.includes(kw)) {
      update("priority_keywords", [...settings.priority_keywords, kw]);
    }
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    update("priority_keywords", settings.priority_keywords.filter((k) => k !== kw));
  };

  const runDiscovery = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-from-hubs");
      if (error) throw error;
      setLastRun({ time: new Date().toISOString(), data: data ?? {} });
      toast.success("Discovery run completed");
      queryClient.invalidateQueries({ queryKey: ["discovery_health"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Discovery failed: ${msg}`);
      setLastRun({ time: new Date().toISOString(), data: { error: msg } });
    } finally {
      setRunning(false);
    }
  };

  const showDepthWarning = settings.firecrawl_maxDepth > 1;
  const showConcurrencyWarning = settings.parallel_hubs * settings.firecrawl_maxPages > 150;

  const healthTiles = [
    { label: "Active Hubs", value: stats?.activeHubs ?? "—", icon: Globe, color: "text-primary" },
    { label: "Ready to Crawl", value: stats?.needsCrawl ?? "—", icon: Clock, color: "text-accent" },
    { label: "Pending URLs", value: stats?.pending ?? "—", icon: Database, color: "text-primary" },
    { label: "Failed (7d)", value: stats?.failed ?? "—", icon: AlertTriangle, color: "text-destructive" },
  ];

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading settings…</div>
      </AdminLayout>
    );
  }

  const successRate = stats?.successRate;
  const successVariant: "default" | "secondary" | "destructive" = successRate !== null && successRate !== undefined
    ? successRate >= 75 ? "default" : successRate >= 50 ? "secondary" : "destructive"
    : "secondary";

  return (
    <AdminLayout>
      <TooltipProvider>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-xl text-foreground flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Agent 1: Discovery Settings
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how discover_from_hubs crawls source hubs and queues URLs.
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

          {/* Last updated + success rate */}
          <div className="flex items-center gap-3">
            {agentRow?.updated_at && (
              <p className="text-xs text-muted-foreground">Last updated: {new Date(agentRow.updated_at).toLocaleString()}</p>
            )}
            {successRate !== null && successRate !== undefined && (
              <Badge variant={successVariant} className="text-[10px]">
                Discovery Success Rate: {successRate}%
              </Badge>
            )}
          </div>

          {/* Health tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

          {/* Last crawl info */}
          <p className="text-xs text-muted-foreground">
            Last crawl: {stats?.lastCrawl ? new Date(stats.lastCrawl).toLocaleString() : "Never"}
          </p>

          {/* Warnings */}
          {showDepthWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Depth 2+ can cause "depth exceeded" errors on Hobby plan. Start with depth 1.</AlertDescription>
            </Alert>
          )}
          {showConcurrencyWarning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                parallel_hubs × maxPages = {settings.parallel_hubs * settings.firecrawl_maxPages}. This may queue many Firecrawl jobs — consider lowering.
              </AlertDescription>
            </Alert>
          )}

          {/* Settings form */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Core controls */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Core Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormNumber label="Hubs per run" value={settings.hubs_per_run} onChange={(v) => updateNum("hubs_per_run", v, 1, 50)} />
                <FormNumber label="Parallel hubs" value={settings.parallel_hubs} onChange={(v) => updateNum("parallel_hubs", v, 1, 10)} />
                <FormNumber label="Hub cooldown (hours)" value={settings.hub_cooldown_hours} onChange={(v) => updateNum("hub_cooldown_hours", v, 1, 168)} />
              </CardContent>
            </Card>

            {/* Firecrawl controls */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Firecrawl Crawl</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Depth</Label>
                  <Select value={String(settings.firecrawl_maxDepth)} onValueChange={(v) => update("firecrawl_maxDepth", parseInt(v, 10))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 (hub page only)</SelectItem>
                      <SelectItem value="1">1 (recommended)</SelectItem>
                      <SelectItem value="2">2 (deep — risky)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FormNumber label="Max pages per hub" value={settings.firecrawl_maxPages} onChange={(v) => updateNum("firecrawl_maxPages", v, 5, 500)} />
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Enable AI-Link Filtering</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs">
                        Uses LLM to analyze link text and only follow relevant scholarship paths, reducing noise and API usage.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch checked={settings.ai_link_filtering} onCheckedChange={() => toggleField("ai_link_filtering")} />
                </div>
              </CardContent>
            </Card>

            {/* Safety controls */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Safety Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormToggle label="Same domain only" checked={settings.same_domain_only} onChange={() => toggleField("same_domain_only")} />
                <FormToggle label="Ignore query URLs" checked={settings.ignore_query_urls} onChange={() => toggleField("ignore_query_urls")} />
                <FormToggle label="Allow PDFs" checked={settings.allow_pdfs} onChange={() => toggleField("allow_pdfs")} />
                {settings.allow_pdfs && (
                  <div className="ml-6 flex items-center gap-2">
                    <Checkbox
                      checked={settings.ai_pdf_ocr}
                      onCheckedChange={() => toggleField("ai_pdf_ocr")}
                      id="ai-pdf-ocr"
                    />
                    <Label htmlFor="ai-pdf-ocr" className="text-xs text-muted-foreground cursor-pointer">
                      Enable AI PDF Parsing (OCR)
                    </Label>
                  </div>
                )}
                <FormToggle label="Stop on rate limit" checked={settings.stop_on_limit} onChange={() => toggleField("stop_on_limit")} />
                <Separator />
                <FormNumber label="Max URLs per hub" value={settings.max_urls_to_queue_per_hub} onChange={(v) => updateNum("max_urls_to_queue_per_hub", v, 10, 1000)} />
                <FormNumber label="Max URLs per run" value={settings.max_total_urls_to_queue_per_run} onChange={(v) => updateNum("max_total_urls_to_queue_per_run", v, 50, 5000)} />
              </CardContent>
            </Card>

            {/* Lock / Backoff */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Lock &amp; Backoff</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormNumber label="Lock duration (min)" value={settings.lock_minutes} onChange={(v) => updateNum("lock_minutes", v, 5, 120)} />
                <FormNumber label="Rate limit backoff (min)" value={settings.backoff_minutes} onChange={(v) => updateNum("backoff_minutes", v, 5, 1440)} />
                <FormNumber label="General failure backoff (min)" value={settings.general_backoff_minutes} onChange={(v) => updateNum("general_backoff_minutes", v, 5, 1440)} />
                <FormNumber label="Depth exceeded backoff (min)" value={settings.depth_backoff_minutes} onChange={(v) => updateNum("depth_backoff_minutes", v, 60, 10080)} />
              </CardContent>
            </Card>
          </div>

          {/* Discovery Intelligence */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Discovery Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Priority Keywords</Label>
                <p className="text-[10px] text-muted-foreground">Keywords to prioritize when scoring discovered links for relevance.</p>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {settings.priority_keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-[10px] gap-1 pr-1">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm flex-1"
                    placeholder="Add keyword…"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  />
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addKeyword}>Add</Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Use Vision for JavaScript Menus</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      Enables a vision-based agent to detect and interact with JavaScript-rendered navigation menus that standard crawling cannot access.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch checked={settings.use_vision_js_menus} onCheckedChange={() => toggleField("use_vision_js_menus")} />
              </div>
            </CardContent>
          </Card>

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
                Trigger the discovery agent immediately. Settings above will be used (save first if changed).
              </p>
              <Button
                size="sm"
                className="gradient-gold text-accent-foreground font-semibold"
                disabled={running}
                onClick={runDiscovery}
              >
                {running ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running…</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Run Discovery Now</>}
              </Button>

              {lastRun && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Last manual run: {new Date(lastRun.time).toLocaleString()}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    <MiniStat label="Hubs OK" value={lastRun.data.hubs_ok} />
                    <MiniStat label="Hubs Failed" value={lastRun.data.hubs_failed} />
                    <MiniStat label="Depth Exceeded" value={lastRun.data.hubs_depth_exceeded} />
                    <MiniStat label="Rate Limited" value={lastRun.data.hubs_queued_or_limited} />
                    <MiniStat label="URLs Queued" value={lastRun.data.urls_queued_total} />
                    <MiniStat label="Runtime" value={lastRun.data.runtime_ms ? `${lastRun.data.runtime_ms}ms` : "—"} />
                  </div>
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

          <Separator />

          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/hubs">
              <Button variant="outline" size="sm" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" /> View Source Hubs</Button>
            </Link>
            <Link to="/admin/queue">
              <Button variant="outline" size="sm" className="text-xs gap-1.5"><Database className="h-3.5 w-3.5" /> View URL Queue</Button>
            </Link>
            <Link to="/admin/jobs">
              <Button variant="outline" size="sm" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Jobs Dashboard</Button>
            </Link>
          </div>
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
};

// ── Sub-components ──

const FormNumber = ({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <Input type="number" className="h-8 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
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

export default AdminDiscoverySettings;
