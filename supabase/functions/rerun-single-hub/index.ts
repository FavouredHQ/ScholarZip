import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

const DEFAULTS = {
  firecrawl_maxDepth: 1,
  firecrawl_maxPages: 50,
  same_domain_only: true,
  ignore_query_urls: true,
  allow_pdfs: true,
  max_urls_to_queue_per_hub: 100,
  backoff_minutes: 60,
  general_backoff_minutes: 240,
  depth_backoff_minutes: 1440,
};

const INCLUDE_KEYWORDS = [
  "scholarship", "scholarships", "funding", "bursary", "bursaries",
  "grant", "grants", "award", "awards", "fellowship", "fellowships",
  "stipend", "tuition", "financial-aid", "finaid",
];
const EXCLUDE_KEYWORDS = [
  "news", "event", "events", "athletics", "faculty", "staff",
  "press", "blog", "alumni", "donate", "jobs", "careers",
  "privacy", "terms", "sitemap", "catalog", "directory",
];
const QUERY_NOISE = ["page=", "sort=", "filter=", "facet=", "q=", "search="];

function getHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}
function shouldInclude(url: string): boolean {
  const l = url.toLowerCase();
  return INCLUDE_KEYWORDS.some((k) => l.includes(k)) && !EXCLUDE_KEYWORDS.some((k) => l.includes(k));
}
function hasQueryNoise(url: string): boolean {
  const l = url.toLowerCase();
  return QUERY_NOISE.some((p) => l.includes(p));
}
function isRateLimit(status: number, body: unknown): boolean {
  if (status === 429 || status === 409 || status === 503) return true;
  if (typeof body === "object" && body !== null) {
    const m = JSON.stringify(body).toLowerCase();
    if (m.includes("rate") || m.includes("concurren") || m.includes("queue")) return true;
  }
  return false;
}
function isDepthError(body: unknown): boolean {
  if (typeof body === "object" && body !== null) {
    const m = JSON.stringify(body).toLowerCase();
    return m.includes("depth") && (m.includes("exceed") || m.includes("limit"));
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) return json({ success: false, error: "FIRECRAWL_API_KEY not configured" }, 500);

  // Parse hub_id from body or query
  let hubId: string | null = null;
  try {
    const body = await req.json();
    hubId = body.hub_id ?? null;
  } catch { /* no body */ }
  if (!hubId) {
    const url = new URL(req.url);
    hubId = url.searchParams.get("hub_id");
  }
  if (!hubId) return json({ success: false, error: "hub_id is required" }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Job lock per hub
  const lockName = `rerun_single_hub:${hubId}`;
  const { data: lockRow } = await supabase.from("job_locks").select("*").eq("job_name", lockName).maybeSingle();
  const now = new Date();
  if (lockRow && new Date(lockRow.locked_until) > now) {
    return json({ success: false, error: "This hub is already being re-run", locked_until: lockRow.locked_until });
  }
  const lockUntil = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  if (lockRow) {
    await supabase.from("job_locks").update({ locked_until: lockUntil, updated_at: now.toISOString() }).eq("job_name", lockName);
  } else {
    await supabase.from("job_locks").insert({ job_name: lockName, locked_until: lockUntil, updated_at: now.toISOString() });
  }
  const releaseLock = async () => {
    await supabase.from("job_locks").update({ locked_until: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("job_name", lockName);
  };

  try {
    // Load hub
    const { data: hub, error: hubErr } = await supabase.from("source_hubs").select("*").eq("id", hubId).maybeSingle();
    if (hubErr || !hub) { await releaseLock(); return json({ success: false, error: hubErr?.message ?? "Hub not found" }, 404); }
    if (!hub.is_active) { await releaseLock(); return json({ success: false, error: "Hub is inactive. Activate it first or pass allow_inactive." }, 400); }

    // Load settings
    const { data: agentRow } = await supabase.from("agent_settings").select("*").eq("agent_name", "discover_from_hubs").maybeSingle();
    const s = (agentRow?.settings ?? {}) as Record<string, unknown>;
    const cfg = {
      firecrawl_maxDepth: (s.firecrawl_maxDepth as number) ?? DEFAULTS.firecrawl_maxDepth,
      firecrawl_maxPages: (s.firecrawl_maxPages as number) ?? DEFAULTS.firecrawl_maxPages,
      same_domain_only: (s.same_domain_only as boolean) ?? DEFAULTS.same_domain_only,
      ignore_query_urls: (s.ignore_query_urls as boolean) ?? DEFAULTS.ignore_query_urls,
      allow_pdfs: (s.allow_pdfs as boolean) ?? DEFAULTS.allow_pdfs,
      max_urls_to_queue_per_hub: (s.max_urls_to_queue_per_hub as number) ?? DEFAULTS.max_urls_to_queue_per_hub,
      backoff_minutes: (s.backoff_minutes as number) ?? DEFAULTS.backoff_minutes,
      general_backoff_minutes: (s.general_backoff_minutes as number) ?? DEFAULTS.general_backoff_minutes,
      depth_backoff_minutes: (s.depth_backoff_minutes as number) ?? DEFAULTS.depth_backoff_minutes,
    };

    const hubHostname = getHostname(hub.hub_url);
    let finalStatus = "ok";

    // Crawl
    console.log(`Rerun hub: ${hub.hub_url}`);
    const crawlRes = await fetch(`${FIRECRAWL_API}/crawl`, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: hub.hub_url, limit: cfg.firecrawl_maxPages, maxDepth: cfg.firecrawl_maxDepth, scrapeOptions: { formats: ["links"] } }),
    });
    const crawlData = await crawlRes.json();

    if (!crawlRes.ok) {
      if (isRateLimit(crawlRes.status, crawlData)) {
        finalStatus = "queued_or_limited";
        const backoff = new Date(Date.now() + cfg.backoff_minutes * 60 * 1000).toISOString();
        await supabase.from("source_hubs").update({ last_crawled_at: new Date().toISOString(), status: finalStatus, error: `Rate limited (HTTP ${crawlRes.status})`, consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff }).eq("id", hubId);
        await releaseLock();
        return json({ hub_id: hubId, hub_url: hub.hub_url, status: finalStatus, urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0, runtime_ms: Date.now() - start });
      }
      if (isDepthError(crawlData)) {
        finalStatus = "depth_exceeded";
        const backoff = new Date(Date.now() + cfg.depth_backoff_minutes * 60 * 1000).toISOString();
        await supabase.from("source_hubs").update({ last_crawled_at: new Date().toISOString(), status: finalStatus, error: "Depth exceeded", consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff }).eq("id", hubId);
        await releaseLock();
        return json({ hub_id: hubId, hub_url: hub.hub_url, status: finalStatus, urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0, runtime_ms: Date.now() - start });
      }
      throw new Error(crawlData.error || `Firecrawl ${crawlRes.status}`);
    }

    const crawlId = crawlData.id;
    if (!crawlId) throw new Error("No crawl ID");

    // Poll
    let completed = false;
    let allLinks: string[] = [];
    const deadline = Date.now() + 5 * 60 * 1000;
    while (!completed && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(`${FIRECRAWL_API}/crawl/${crawlId}`, { headers: { Authorization: `Bearer ${firecrawlKey}` } });
      const data = await res.json();
      if (!res.ok && isRateLimit(res.status, data)) {
        finalStatus = "queued_or_limited";
        const backoff = new Date(Date.now() + cfg.backoff_minutes * 60 * 1000).toISOString();
        await supabase.from("source_hubs").update({ last_crawled_at: new Date().toISOString(), status: finalStatus, error: `Rate limited during poll`, consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff }).eq("id", hubId);
        await releaseLock();
        return json({ hub_id: hubId, hub_url: hub.hub_url, status: finalStatus, urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0, runtime_ms: Date.now() - start });
      }
      if (data.status === "completed") {
        completed = true;
        for (const page of (data.data ?? [])) {
          allLinks.push(...(page.links ?? []));
          if (page.metadata?.sourceURL) allLinks.push(page.metadata.sourceURL);
        }
      } else if (data.status === "failed") {
        if (isDepthError(data)) {
          finalStatus = "depth_exceeded";
          const backoff = new Date(Date.now() + cfg.depth_backoff_minutes * 60 * 1000).toISOString();
          await supabase.from("source_hubs").update({ last_crawled_at: new Date().toISOString(), status: finalStatus, error: "Depth exceeded during crawl", consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff }).eq("id", hubId);
          await releaseLock();
          return json({ hub_id: hubId, hub_url: hub.hub_url, status: finalStatus, urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0, runtime_ms: Date.now() - start });
        }
        throw new Error(data.error || "Crawl failed");
      }
    }
    if (!completed) throw new Error("Crawl timed out");

    // Filter pipeline
    let candidates = [...new Set(allLinks)];
    const urlsDiscovered = candidates.length;

    if (cfg.same_domain_only) candidates = candidates.filter((u) => getHostname(u) === hubHostname);
    if (cfg.ignore_query_urls) candidates = candidates.filter((u) => !hasQueryNoise(u));
    if (!cfg.allow_pdfs) candidates = candidates.filter((u) => !u.toLowerCase().endsWith(".pdf"));
    candidates = candidates.filter(shouldInclude);
    const urlsAfterFilter = candidates.length;

    // Dedupe
    const { data: existingQueue } = await supabase.from("url_queue").select("url");
    const { data: existingScholarships } = await supabase.from("scholarships").select("source_url");
    const existing = new Set<string>();
    (existingQueue ?? []).forEach((r) => existing.add(r.url));
    (existingScholarships ?? []).forEach((r) => { if (r.source_url) existing.add(r.source_url); });

    const newUrls = candidates.filter((u) => !existing.has(u));
    const urlsSkipped = candidates.length - newUrls.length;
    const toQueue = newUrls.slice(0, cfg.max_urls_to_queue_per_hub);

    if (toQueue.length > 0) {
      const rows = toQueue.map((url) => ({
        url,
        provider_type: hub.provider_type ?? null,
        provider_subtype: hub.provider_subtype ?? null,
        provider_name: hub.provider_name ?? null,
        status: "pending",
        attempts: 0,
        discovered_from: hubId,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error: insertErr } = await supabase.from("url_queue").upsert(rows.slice(i, i + 100), { onConflict: "url", ignoreDuplicates: true });
        if (insertErr) console.error("Insert error:", insertErr.message);
      }
    }

    // Success update
    await supabase.from("source_hubs").update({
      last_crawled_at: new Date().toISOString(), status: "ok", error: null,
      consecutive_failures: 0, next_crawl_at: null,
    }).eq("id", hubId);

    await releaseLock();
    return json({
      hub_id: hubId, hub_url: hub.hub_url, status: "ok",
      urls_discovered: urlsDiscovered, urls_after_filter: urlsAfterFilter,
      urls_queued: toQueue.length, urls_skipped_duplicates: urlsSkipped,
      runtime_ms: Date.now() - start,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Rerun hub ${hubId} failed:`, msg);
    const { data: hub } = await supabase.from("source_hubs").select("consecutive_failures").eq("id", hubId).maybeSingle();
    const backoff = new Date(Date.now() + (DEFAULTS.general_backoff_minutes) * 60 * 1000).toISOString();
    await supabase.from("source_hubs").update({
      last_crawled_at: new Date().toISOString(), status: "failed",
      error: msg.slice(0, 500),
      consecutive_failures: ((hub?.consecutive_failures as number) ?? 0) + 1,
      next_crawl_at: backoff,
    }).eq("id", hubId);
    await releaseLock();
    return json({ success: false, hub_id: hubId, error: msg, runtime_ms: Date.now() - start }, 500);
  }
});
