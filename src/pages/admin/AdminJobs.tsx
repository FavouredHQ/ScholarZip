import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Database, RefreshCw, Zap, CheckCircle, AlertTriangle, Clock, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const AdminJobs = () => {
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [extractionRunning, setExtractionRunning] = useState(false);
  const [freshnessRunning, setFreshnessRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ job: string; data: Record<string, unknown> } | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const [hubs, pendingUrls, failedUrls, scholarships, recentScholarships, recentVerified] = await Promise.all([
        supabase.from("source_hubs").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("url_queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("scholarships").select("*", { count: "exact", head: true }),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("scholarships").select("*", { count: "exact", head: true }).gte("last_verified_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);
      return {
        activeHubs: hubs.count ?? 0,
        pendingUrls: pendingUrls.count ?? 0,
        failedUrls: failedUrls.count ?? 0,
        totalScholarships: scholarships.count ?? 0,
        recentScholarships: recentScholarships.count ?? 0,
        recentVerified: recentVerified.count ?? 0,
      };
    },
    refetchInterval: 30000,
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

  const statCards = [
    { label: "Active Hubs", value: stats?.activeHubs ?? "—", icon: Globe, color: "text-primary" },
    { label: "Pending URLs", value: stats?.pendingUrls ?? "—", icon: Clock, color: "text-accent" },
    { label: "Failed URLs", value: stats?.failedUrls ?? "—", icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Scholarships", value: stats?.totalScholarships ?? "—", icon: BarChart3, color: "text-primary" },
    { label: "Added (7d)", value: stats?.recentScholarships ?? "—", icon: CheckCircle, color: "text-success" },
    { label: "Verified (7d)", value: stats?.recentVerified ?? "—", icon: RefreshCw, color: "text-primary" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <h1 className="font-semibold text-xl text-foreground">Jobs & Health</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{s.value}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Job Triggers */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Discovery
              </CardTitle>
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

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" /> Extraction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Process pending URLs from the queue and extract structured scholarship data.</p>
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

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" /> Freshness Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Re-verify existing scholarships, update content hashes, and mark expired entries.</p>
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
    </AdminLayout>
  );
};

export default AdminJobs;
