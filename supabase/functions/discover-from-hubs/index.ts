import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";
const JOB_NAME = "discover_from_hubs";

const DEFAULTS = {
  enabled: true,
  hubs_per_run: 5,
  hub_cooldown_hours: 24,
  firecrawl_maxDepth: 8,
  firecrawl_maxPages: 50,
  parallel_hubs: 2,
  same_domain_only: true,
  ignore_query_urls: true,
  allow_pdfs: true,
  max_urls_to_queue_per_hub: 100,
  max_total_urls_to_queue_per_run: 500,
  stop_on_limit: true,
  lock_minutes: 20,
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

const QUERY_PARAMS_TO_REJECT = ["page=", "sort=", "filter=", "facet=", "q=", "search="];

function getHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function computeUrlPathDepth(url: string): number {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.length;
  } catch { return 0; }
}

function shouldIncludeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    INCLUDE_KEYWORDS.some((kw) => lower.includes(kw)) &&
    !EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw))
  );
}

function hasQueryNoise(url: string): boolean {
  const lower = url.toLowerCase();
  return QUERY_PARAMS_TO_REJECT.some((p) => lower.includes(p));
}

function classifyError(httpStatus: number | null, body: unknown): { status: string; backoffKey: "backoff_minutes" | "general_backoff_minutes" | "depth_backoff_minutes" } {
  const msg = typeof body === "object" && body !== null ? JSON.stringify(body).toLowerCase() : String(body).toLowerCase();

  if (msg.includes("depth exceeded")) {
    return { status: "depth_exceeded", backoffKey: "depth_backoff_minutes" };
  }
  if (httpStatus && (httpStatus === 429 || httpStatus === 409 || httpStatus === 503)) {
    return { status: "queued_or_limited", backoffKey: "backoff_minutes" };
  }
  if (msg.includes("rate") || msg.includes("concurren") || msg.includes("queue")) {
    return { status: "queued_or_limited", backoffKey: "backoff_minutes" };
  }
  if (httpStatus && httpStatus >= 400) {
    return { status: `http_error_${httpStatus}`, backoffKey: "general_backoff_minutes" };
  }
  return { status: "failed", backoffKey: "general_backoff_minutes" };
}

function extractErrorSnippet(body: unknown): string {
  if (typeof body === "string") return body.slice(0, 1000);
  if (typeof body === "object" && body !== null) return JSON.stringify(body).slice(0, 1000);
  return String(body).slice(0, 1000);
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).href;
      links.push(resolved);
    } catch { /* skip invalid */ }
  }
  return links;
}

/** Scrape a single page and return outbound links */
async function scrapeSinglePage(hubUrl: string, firecrawlKey: string): Promise<{ ok: boolean; links: string[]; httpStatus: number; errorSnippet: string | null; rawData: unknown }> {
  const res = await fetch(`${FIRECRAWL_API}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: hubUrl, formats: ["links", "html"], onlyMainContent: false }),
  });
  const resData = await res.json();
  if (!res.ok) {
    return { ok: false, links: [], httpStatus: res.status, errorSnippet: extractErrorSnippet(resData), rawData: resData };
  }
  const data = resData.data ?? resData;
  const links: string[] = [];
  if (Array.isArray(data.links) && data.links.length > 0) {
    links.push(...data.links);
  } else if (data.html) {
    links.push(...extractLinksFromHtml(data.html, hubUrl));
  }
  if (data.metadata?.sourceURL) links.push(data.metadata.sourceURL);
  return { ok: true, links, httpStatus: res.status, errorSnippet: null, rawData: resData };
}

type Settings = typeof DEFAULTS;
type Hub = Record<string, unknown>;

interface HubResult {
  status: string;
  urlsDiscovered: number;
  urlsAfterFilter: number;
  urlsQueued: number;
  urlsSkippedDupes: number;
  urlsSkippedExternal: number;
  urlsSkippedQuery: number;
  firecrawl_mode_used: string;
  firecrawl_endpoint_used: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();
  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

  if (!firecrawlKey) {
    return json({ success: false, error: "FIRECRAWL_API_KEY not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── A) Load runtime settings ──
  let cfg: Settings = { ...DEFAULTS };
  const { data: agentRow } = await supabase
    .from("agent_settings")
    .select("*")
    .eq("agent_name", JOB_NAME)
    .maybeSingle();

  if (agentRow) {
    const s = (agentRow.settings ?? {}) as Record<string, unknown>;
    cfg = {
      enabled: agentRow.enabled ?? DEFAULTS.enabled,
      hubs_per_run: (s.hubs_per_run as number) ?? DEFAULTS.hubs_per_run,
      hub_cooldown_hours: (s.hub_cooldown_hours as number) ?? DEFAULTS.hub_cooldown_hours,
      firecrawl_maxDepth: (s.firecrawl_maxDepth as number) ?? DEFAULTS.firecrawl_maxDepth,
      firecrawl_maxPages: (s.firecrawl_maxPages as number) ?? DEFAULTS.firecrawl_maxPages,
      parallel_hubs: (s.parallel_hubs as number) ?? DEFAULTS.parallel_hubs,
      same_domain_only: (s.same_domain_only as boolean) ?? DEFAULTS.same_domain_only,
      ignore_query_urls: (s.ignore_query_urls as boolean) ?? DEFAULTS.ignore_query_urls,
      allow_pdfs: (s.allow_pdfs as boolean) ?? DEFAULTS.allow_pdfs,
      max_urls_to_queue_per_hub: (s.max_urls_to_queue_per_hub as number) ?? DEFAULTS.max_urls_to_queue_per_hub,
      max_total_urls_to_queue_per_run: (s.max_total_urls_to_queue_per_run as number) ?? DEFAULTS.max_total_urls_to_queue_per_run,
      stop_on_limit: (s.stop_on_limit as boolean) ?? DEFAULTS.stop_on_limit,
      lock_minutes: (s.lock_minutes as number) ?? DEFAULTS.lock_minutes,
      backoff_minutes: (s.backoff_minutes as number) ?? DEFAULTS.backoff_minutes,
      general_backoff_minutes: (s.general_backoff_minutes as number) ?? DEFAULTS.general_backoff_minutes,
      depth_backoff_minutes: (s.depth_backoff_minutes as number) ?? DEFAULTS.depth_backoff_minutes,
    };
  }

  if (!cfg.enabled) {
    return json({ skipped: true, reason: "disabled", runtime_ms: Date.now() - start });
  }

  // ── B) Job lock ──
  const { data: lockRow } = await supabase
    .from("job_locks")
    .select("*")
    .eq("job_name", JOB_NAME)
    .maybeSingle();

  const now = new Date();
  if (lockRow && new Date(lockRow.locked_until) > now) {
    return json({ skipped: true, reason: "locked", locked_until: lockRow.locked_until, runtime_ms: Date.now() - start });
  }

  const lockUntil = new Date(now.getTime() + cfg.lock_minutes * 60 * 1000).toISOString();
  if (lockRow) {
    await supabase.from("job_locks").update({ locked_until: lockUntil, updated_at: now.toISOString() }).eq("job_name", JOB_NAME);
  } else {
    await supabase.from("job_locks").insert({ job_name: JOB_NAME, locked_until: lockUntil, updated_at: now.toISOString() });
  }

  const releaseLock = async () => {
    await supabase.from("job_locks").update({ locked_until: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("job_name", JOB_NAME);
  };

  try {
    // ── C) Hub selection ──
    const cooldownCutoff = new Date(Date.now() - cfg.hub_cooldown_hours * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: hubs, error: hubsErr } = await supabase
      .from("source_hubs")
      .select("*")
      .eq("is_active", true)
      .or(`next_crawl_at.is.null,next_crawl_at.lte.${nowIso}`)
      .or(`last_crawled_at.is.null,last_crawled_at.lte.${cooldownCutoff}`)
      .order("last_crawled_at", { ascending: true, nullsFirst: true })
      .limit(cfg.hubs_per_run);

    if (hubsErr) {
      await releaseLock();
      return json({ success: false, error: hubsErr.message }, 500);
    }

    if (!hubs || hubs.length === 0) {
      await releaseLock();
      return json({
        skipped: false, hubs_selected: 0, hubs_processed: 0, hubs_ok: 0,
        hubs_failed: 0, hubs_depth_exceeded: 0, hubs_queued_or_limited: 0,
        urls_discovered_total: 0, urls_after_filter_total: 0, urls_queued_total: 0,
        urls_skipped_duplicates_total: 0, urls_skipped_external_domain_total: 0,
        urls_skipped_query_total: 0, runtime_ms: Date.now() - start,
      });
    }

    // Pre-fetch existing URLs for dedup
    const { data: existingQueue } = await supabase.from("url_queue").select("url");
    const { data: existingScholarships } = await supabase.from("scholarships").select("source_url");
    const existingUrls = new Set<string>();
    (existingQueue ?? []).forEach((r) => existingUrls.add(r.url));
    (existingScholarships ?? []).forEach((r) => { if (r.source_url) existingUrls.add(r.source_url); });

    // Totals
    let hubsOk = 0, hubsFailed = 0, hubsLimited = 0, hubsDepthExceeded = 0;
    let urlsDiscoveredTotal = 0, urlsAfterFilterTotal = 0, urlsQueuedTotal = 0;
    let urlsSkippedDupesTotal = 0, urlsSkippedExternalTotal = 0, urlsSkippedQueryTotal = 0;
    let stopEarly = false;

    // ── Process a single hub ──
    const processHub = async (hub: Hub): Promise<HubResult> => {
      const hubUrl = hub.hub_url as string;
      const hubId = hub.id as string;
      const hubHostname = getHostname(hubUrl);
      const crawlMode = (hub.crawl_mode as string) ?? "crawl";

      const result: HubResult = {
        status: "ok", urlsDiscovered: 0, urlsAfterFilter: 0, urlsQueued: 0,
        urlsSkippedDupes: 0, urlsSkippedExternal: 0, urlsSkippedQuery: 0,
        firecrawl_mode_used: crawlMode, firecrawl_endpoint_used: crawlMode === "single_page" ? "scrape" : "crawl",
      };

      console.log(`Crawling hub (${crawlMode}): ${hubUrl}`);
      let allLinks: string[] = [];

      if (crawlMode === "single_page") {
        // ── Single Page Mode ──
        result.firecrawl_endpoint_used = "scrape";
        const scrapeResult = await scrapeSinglePage(hubUrl, firecrawlKey!);

        if (!scrapeResult.ok) {
          const { status: errStatus, backoffKey } = classifyError(scrapeResult.httpStatus, scrapeResult.rawData);
          const backoff = new Date(Date.now() + cfg[backoffKey] * 60 * 1000).toISOString();
          await supabase.from("source_hubs").update({
            last_crawled_at: new Date().toISOString(), status: errStatus,
            error: (scrapeResult.errorSnippet ?? "Scrape failed").slice(0, 1000),
            consecutive_failures: ((hub.consecutive_failures as number) ?? 0) + 1, next_crawl_at: backoff,
          }).eq("id", hubId);
          result.status = errStatus;
          return result;
        }
        allLinks = scrapeResult.links;

      } else {
        // ── Crawl Mode (default) ──
        const hubDepth = computeUrlPathDepth(hubUrl);
        const baseMaxDepth = (hub.crawl_depth_override as number) ?? cfg.firecrawl_maxDepth;
        const effectiveMaxDepth = Math.max(baseMaxDepth, hubDepth + 2);
        const maxPages = (hub.crawl_pages_override as number) ?? cfg.firecrawl_maxPages;

        console.log(`Hub path depth=${hubDepth}, effectiveMaxDepth=${effectiveMaxDepth}`);

        const crawlRes = await fetch(`${FIRECRAWL_API}/crawl`, {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: hubUrl, limit: maxPages, maxDepth: effectiveMaxDepth, scrapeOptions: { formats: ["links"] } }),
        });
        const crawlData = await crawlRes.json();

        if (!crawlRes.ok) {
          const { status: errStatus, backoffKey } = classifyError(crawlRes.status, crawlData);

          // ── Depth exceeded fallback ──
          if (errStatus === "depth_exceeded") {
            console.log(`Depth exceeded for ${hubUrl}, falling back to single_page scrape`);
            result.firecrawl_mode_used = "single_page_fallback";
            result.firecrawl_endpoint_used = "scrape";
            const fallback = await scrapeSinglePage(hubUrl, firecrawlKey!);
            if (fallback.ok) {
              allLinks = fallback.links;
              result.status = "ok_fallback_single_page";
            } else {
              const backoff = new Date(Date.now() + cfg.general_backoff_minutes * 60 * 1000).toISOString();
              await supabase.from("source_hubs").update({
                last_crawled_at: new Date().toISOString(), status: "failed",
                error: (fallback.errorSnippet ?? "Fallback scrape failed").slice(0, 1000),
                consecutive_failures: ((hub.consecutive_failures as number) ?? 0) + 1, next_crawl_at: backoff,
              }).eq("id", hubId);
              result.status = "failed";
              return result;
            }
          } else {
            const backoff = new Date(Date.now() + cfg[backoffKey] * 60 * 1000).toISOString();
            const errorMsg = extractErrorSnippet(crawlData).slice(0, 1000);
            await supabase.from("source_hubs").update({
              last_crawled_at: new Date().toISOString(), status: errStatus, error: errorMsg,
              consecutive_failures: ((hub.consecutive_failures as number) ?? 0) + 1, next_crawl_at: backoff,
            }).eq("id", hubId);
            result.status = errStatus;
            if (errStatus === "queued_or_limited" && cfg.stop_on_limit) stopEarly = true;
            return result;
          }
        } else {
          const crawlId = crawlData.id;
          if (!crawlId) throw new Error("No crawl ID returned");

          // Poll
          let completed = false;
          const pollDeadline = Date.now() + 5 * 60 * 1000;

          while (!completed && Date.now() < pollDeadline) {
            await new Promise((r) => setTimeout(r, 5000));
            const statusRes = await fetch(`${FIRECRAWL_API}/crawl/${crawlId}`, {
              headers: { Authorization: `Bearer ${firecrawlKey}` },
            });
            const statusData = await statusRes.json();

            if (!statusRes.ok) {
              const { status: errStatus, backoffKey } = classifyError(statusRes.status, statusData);
              if (errStatus === "queued_or_limited") {
                const backoff = new Date(Date.now() + cfg[backoffKey] * 60 * 1000).toISOString();
                await supabase.from("source_hubs").update({
                  last_crawled_at: new Date().toISOString(), status: errStatus,
                  error: `Rate limited during poll (HTTP ${statusRes.status})`,
                  consecutive_failures: ((hub.consecutive_failures as number) ?? 0) + 1, next_crawl_at: backoff,
                }).eq("id", hubId);
                result.status = errStatus;
                return result;
              }
            }

            if (statusData.status === "completed") {
              completed = true;
              for (const page of (statusData.data ?? [])) {
                allLinks.push(...(page.links ?? []));
                if (page.metadata?.sourceURL) allLinks.push(page.metadata.sourceURL);
              }
            } else if (statusData.status === "failed") {
              const { status: errStatus } = classifyError(null, statusData);

              // Depth exceeded fallback during poll
              if (errStatus === "depth_exceeded") {
                console.log(`Crawl failed with depth_exceeded during poll for ${hubUrl}, falling back to scrape`);
                result.firecrawl_mode_used = "single_page_fallback";
                result.firecrawl_endpoint_used = "scrape";
                const fallback = await scrapeSinglePage(hubUrl, firecrawlKey!);
                if (fallback.ok) {
                  allLinks = fallback.links;
                  result.status = "ok_fallback_single_page";
                  completed = true;
                } else {
                  const backoff = new Date(Date.now() + cfg.general_backoff_minutes * 60 * 1000).toISOString();
                  await supabase.from("source_hubs").update({
                    last_crawled_at: new Date().toISOString(), status: "failed",
                    error: (fallback.errorSnippet ?? "Fallback scrape failed").slice(0, 1000),
                    consecutive_failures: ((hub.consecutive_failures as number) ?? 0) + 1, next_crawl_at: backoff,
                  }).eq("id", hubId);
                  result.status = "failed";
                  return result;
                }
              } else {
                const { backoffKey } = classifyError(null, statusData);
                const backoff = new Date(Date.now() + cfg[backoffKey] * 60 * 1000).toISOString();
                const errorMsg = extractErrorSnippet(statusData).slice(0, 1000);
                await supabase.from("source_hubs").update({
                  last_crawled_at: new Date().toISOString(), status: errStatus, error: errorMsg,
                  consecutive_failures: ((hub.consecutive_failures as number) ?? 0) + 1, next_crawl_at: backoff,
                }).eq("id", hubId);
                result.status = errStatus;
                return result;
              }
            }
          }

          if (!completed) throw new Error("Crawl timed out after 5 minutes");
        }
      }

      const uniqueLinks = [...new Set(allLinks)];
      result.urlsDiscovered = uniqueLinks.length;

      // Filter pipeline
      let candidates = uniqueLinks;

      if (cfg.same_domain_only) {
        const before = candidates.length;
        candidates = candidates.filter((u) => getHostname(u) === hubHostname);
        result.urlsSkippedExternal = before - candidates.length;
      }

      if (cfg.ignore_query_urls) {
        const before = candidates.length;
        candidates = candidates.filter((u) => !hasQueryNoise(u));
        result.urlsSkippedQuery = before - candidates.length;
      }

      if (!cfg.allow_pdfs) {
        candidates = candidates.filter((u) => !u.toLowerCase().endsWith(".pdf"));
      }

      candidates = candidates.filter(shouldIncludeUrl);
      result.urlsAfterFilter = candidates.length;

      // Dedupe
      const newUrls = candidates.filter((u) => !existingUrls.has(u));
      result.urlsSkippedDupes = candidates.length - newUrls.length;

      // Caps
      const remaining = cfg.max_total_urls_to_queue_per_run - urlsQueuedTotal;
      const toQueue = newUrls.slice(0, Math.min(cfg.max_urls_to_queue_per_hub, remaining));

      if (toQueue.length > 0) {
        const rows = toQueue.map((url) => ({
          url,
          provider_type: (hub.provider_type as string) ?? null,
          provider_subtype: (hub.provider_subtype as string) ?? null,
          provider_name: (hub.provider_name as string) ?? null,
          status: "pending",
          attempts: 0,
          discovered_from: hubId,
        }));

        for (let i = 0; i < rows.length; i += 100) {
          const { error: insertErr } = await supabase
            .from("url_queue")
            .upsert(rows.slice(i, i + 100), { onConflict: "url", ignoreDuplicates: true });
          if (insertErr) console.error(`Insert error for hub ${hubId}:`, insertErr.message);
        }

        toQueue.forEach((u) => existingUrls.add(u));
      }

      result.urlsQueued = toQueue.length;

      // Success update — use result.status which may be "ok_fallback_single_page"
      const finalStatus = result.status.startsWith("ok") ? result.status : "ok";
      await supabase.from("source_hubs").update({
        last_crawled_at: new Date().toISOString(), status: finalStatus, error: null,
        consecutive_failures: 0, next_crawl_at: null,
      }).eq("id", hubId);

      result.status = finalStatus;
      console.log(`Hub ${hubUrl}: discovered=${result.urlsDiscovered}, filtered=${result.urlsAfterFilter}, queued=${result.urlsQueued}, mode=${result.firecrawl_mode_used}`);
      return result;
    };

    // ── E) Process hubs with limited concurrency ──
    const processHubSafe = async (hub: Hub) => {
      try {
        const r = await processHub(hub);
        urlsDiscoveredTotal += r.urlsDiscovered;
        urlsAfterFilterTotal += r.urlsAfterFilter;
        urlsQueuedTotal += r.urlsQueued;
        urlsSkippedDupesTotal += r.urlsSkippedDupes;
        urlsSkippedExternalTotal += r.urlsSkippedExternal;
        urlsSkippedQueryTotal += r.urlsSkippedQuery;

        if (r.status.startsWith("ok")) hubsOk++;
        else if (r.status === "depth_exceeded") hubsDepthExceeded++;
        else if (r.status === "queued_or_limited") {
          hubsLimited++;
          if (cfg.stop_on_limit) stopEarly = true;
        } else hubsFailed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Hub ${hub.hub_url} failed:`, msg);
        const backoff = new Date(Date.now() + cfg.general_backoff_minutes * 60 * 1000).toISOString();
        await supabase.from("source_hubs").update({
          last_crawled_at: new Date().toISOString(), status: "failed",
          error: msg.slice(0, 1000),
          consecutive_failures: ((hub.consecutive_failures as number) ?? 0) + 1,
          next_crawl_at: backoff,
        }).eq("id", hub.id as string);
        hubsFailed++;
      }
    };

    if (cfg.parallel_hubs <= 1) {
      for (const hub of hubs) {
        if (stopEarly || urlsQueuedTotal >= cfg.max_total_urls_to_queue_per_run) break;
        await processHubSafe(hub);
      }
    } else {
      const concurrency = cfg.parallel_hubs;
      let idx = 0;
      while (idx < hubs.length && !stopEarly && urlsQueuedTotal < cfg.max_total_urls_to_queue_per_run) {
        const batch = hubs.slice(idx, idx + concurrency);
        await Promise.all(batch.map(processHubSafe));
        idx += concurrency;
      }
    }

    const summary = {
      skipped: false,
      settings_used: {
        hubs_per_run: cfg.hubs_per_run, firecrawl_maxDepth: cfg.firecrawl_maxDepth,
        firecrawl_maxPages: cfg.firecrawl_maxPages, parallel_hubs: cfg.parallel_hubs,
        same_domain_only: cfg.same_domain_only, stop_on_limit: cfg.stop_on_limit,
      },
      hubs_selected: hubs.length,
      hubs_processed: hubsOk + hubsFailed + hubsLimited + hubsDepthExceeded,
      hubs_ok: hubsOk,
      hubs_failed: hubsFailed,
      hubs_depth_exceeded: hubsDepthExceeded,
      hubs_queued_or_limited: hubsLimited,
      urls_discovered_total: urlsDiscoveredTotal,
      urls_after_filter_total: urlsAfterFilterTotal,
      urls_queued_total: urlsQueuedTotal,
      urls_skipped_duplicates_total: urlsSkippedDupesTotal,
      urls_skipped_external_domain_total: urlsSkippedExternalTotal,
      urls_skipped_query_total: urlsSkippedQueryTotal,
      runtime_ms: Date.now() - start,
    };

    console.log("discover-from-hubs complete:", JSON.stringify(summary));
    await releaseLock();
    return json(summary);
  } catch (err) {
    await releaseLock();
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
});
