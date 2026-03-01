import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe, Database, RefreshCw, Zap, CheckCircle, AlertTriangle, Clock, BarChart3, DollarSign, Info, Trash2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Live Pulse indicator                                              */
/* ------------------------------------------------------------------ */
const LivePulse = ({ jobName, locks }: { jobName: string; locks: Record<string, string> }) => {
  const lockedUntil = locks[jobName];
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Agent Active</span>
      </div>
    );
  }

  return (
    <span className="text-[10px] text-muted-foreground">
      {lockedUntil ? `Last run: ${new Date(lockedUntil).toLocaleString()}` : "No runs yet"}
    </span>
  );
};

const AdminJobs = () => {
  const navigate = useNavigate();
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [extractionRunning, setExtractionRunning] = useState(false);
  const [freshnessRunning, setFreshnessRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ job: string; data: Record<string, unknown> } | null>(null);

  /* Stats query */
  const { data: stats } = useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const [hubs, pendingUrls, failedUrls, scholarships, recentScholarships, recentVerified, doneLastHour, inactiveScholarships] = await Promise.all([
        supabase.from("source_hubs").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("scholarships").select("*", { count: "exact", head: true }),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).gte("last_verified_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "done").gte("processed_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).eq("is_active", false),
      ]);
      return {
        activeHubs: hubs.count ?? 0,
        pendingUrls: pendingUrls.count ?? 0,
        failedUrls: failedUrls.count ?? 0,
        totalScholarships: scholarships.count ?? 0,
        recentScholarships: recentScholarships.count ?? 0,
        recentVerified: recentVerified.count ?? 0,
        processingRate: doneLastHour.count ?? 0,
        inactiveScholarships: inactiveScholarships.count ?? 0,
      };
    },
    refetchInterval: 30000,
  });

  /* Job locks query */
  const { data: jobLocks } = useQuery({
    queryKey: ["job_locks"],
    queryFn: async () => {
      const { data } = await supabase.from("job_locks").select("*");
      const map: Record<string, string> = {};
      (data ?? []).forEach((l) => { map[l.job_name] = l.locked_until; });
      return map;
    },
    refetchInterval: 10000,
  });

  const invokeFunction = async (name: string, setRunning: (v: boolean) => void) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(name);
      if (error) throw error;
      setLastResult({ job: name, data: data ?? {} });
      toast.success(`${name} completed`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`${name} failed: ${msg}`);
      setLastResult({ job: name, data: { error: msg } });
    } finally {
      setRunning(false);
    }
  };

  const locks = jobLocks ?? {};
  const burnRate = stats?.processingRate ? `~$${((stats.processingRate / 1000) * 2.5 * 1000).toFixed(0)}/1k URLs` : "—";

  return (
    <AdminLayout>
      <TooltipProvider>
        <div className="space-y-8">
          <h1 className="font-semibold text-xl text-foreground">Jobs & Health</h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* Active Hubs */}
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Active Hubs</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.activeHubs ?? "—"}</span>
              </CardContent>
            </Card>

            {/* Pending URLs */}
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-accent" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pending URLs</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.pendingUrls ?? "—"}</span>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Est. {stats?.processingRate ?? 0} URLs/hr</span>
                </div>
              </CardContent>
            </Card>

            {/* Failed URLs — clickable */}
            <Card
              className="shadow-card cursor-pointer hover:border-destructive/50 transition-colors"
              onClick={() => navigate("/admin/queue?status=failed")}
            >
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Failed URLs</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.failedUrls ?? "—"}</span>
                <span className="text-[10px] text-primary mt-1 block">Click to view →</span>
              </CardContent>
            </Card>

            {/* Total Scholarships */}
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Scholarships</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.totalScholarships ?? "—"}</span>
              </CardContent>
            </Card>

            {/* Added (7d) */}
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Added (7d)</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.recentScholarships ?? "—"}</span>
              </CardContent>
            </Card>

            {/* Verified (7d) */}
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Verified (7d)</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.recentVerified ?? "—"}</span>
              </CardContent>
            </Card>

            {/* Burn Rate */}
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Burn Rate</span>
                </div>
                <span className="text-lg font-bold text-foreground">{burnRate}</span>
              </CardContent>
            </Card>

            {/* Expired / Inactive */}
            <Card className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Inactive</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{stats?.inactiveScholarships ?? "—"}</span>
              </CardContent>
            </Card>
          </div>

          {/* Job Triggers */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Discovery */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" /> Discovery
                  </CardTitle>
                  <LivePulse jobName="discover_from_hubs" locks={locks} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Crawl active source hubs and populate URL queue with discovered scholarship pages.</p>
                <Button
                  size="sm"
                  className="w-full gradient-gold text-accent-foreground font-semibold"
                  disabled={discoveryRunning}
                  onClick={() => invokeFunction("discover-from-hubs", setDiscoveryRunning)}
                >
                  {discoveryRunning ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running...</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Run Discovery Now</>}
                </Button>
              </CardContent>
            </Card>

            {/* Extraction */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" /> Extraction
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-xs">
                        Uses Vision-LLMs to navigate tricky university portals and extract structured scholarship data from complex page layouts.
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <LivePulse jobName="process_url_queue" locks={locks} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Process pending URLs from the queue and extract structured scholarship data.</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  <span>Burn Rate</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{burnRate}</Badge>
                </div>
                <Button
                  size="sm"
                  className="w-full gradient-gold text-accent-foreground font-semibold"
                  disabled={extractionRunning}
                  onClick={() => invokeFunction("process-url-queue", setExtractionRunning)}
                >
                  {extractionRunning ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running...</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Run Extraction Now</>}
                </Button>
              </CardContent>
            </Card>

            {/* Freshness Check */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" /> Freshness Check
                  </CardTitle>
                  <LivePulse jobName="freshness_check" locks={locks} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Re-verify existing scholarships, update content hashes, and mark expired entries.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/50 rounded px-2 py-1.5 text-center">
                    <div className="text-lg font-bold text-foreground">{stats?.recentVerified ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Changes Detected</div>
                  </div>
                  <div className="bg-muted/50 rounded px-2 py-1.5 text-center">
                    <div className="text-lg font-bold text-foreground">{stats?.inactiveScholarships ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Expired Removed</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full gradient-gold text-accent-foreground font-semibold"
                  disabled={freshnessRunning}
                  onClick={() => invokeFunction("freshness-check", setFreshnessRunning)}
                >
                  {freshnessRunning ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running...</> : <><Zap className="h-3.5 w-3.5 mr-1.5" /> Run Freshness Check</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Last Result */}
          {lastResult && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Last Result: <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{lastResult.job}</code></CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto max-h-48 text-foreground">
                  {JSON.stringify(lastResult.data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
};

export default AdminJobs;
