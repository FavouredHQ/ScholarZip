import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

const DEFAULTS = {
  firecrawl_maxDepth: 8,
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

function computeUrlPathDepth(url: string): number {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.length;
  } catch { return 0; }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey) return json({ success: false, error: "FIRECRAWL_API_KEY not configured" }, 500);

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

  let firecrawl_mode_used = "crawl";
  let firecrawl_endpoint_used = "crawl";
  let firecrawl_http_status: number | null = null;
  let firecrawl_error_snippet: string | null = null;

  const makeResult = (extra: Record<string, unknown>) => json({
    hub_id: hubId, firecrawl_mode_used, firecrawl_endpoint_used,
    firecrawl_http_status, firecrawl_error_snippet, runtime_ms: Date.now() - start, ...extra,
  }, (extra.success === false) ? 500 : 200);

  try {
    const { data: hub, error: hubErr } = await supabase.from("source_hubs").select("*").eq("id", hubId).maybeSingle();
    if (hubErr || !hub) { await releaseLock(); return json({ success: false, error: hubErr?.message ?? "Hub not found" }, 404); }
    if (!hub.is_active) { await releaseLock(); return json({ success: false, error: "Hub is inactive. Activate it first." }, 400); }

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

    const crawlMode = hub.crawl_mode ?? "crawl";
    firecrawl_mode_used = crawlMode;
    const hubHostname = getHostname(hub.hub_url);
    let allLinks: string[] = [];
    let finalStatus = "ok";

    console.log(`Rerun hub (${crawlMode}): ${hub.hub_url}`);

    if (crawlMode === "single_page") {
      // ── Single Page Mode ──
      firecrawl_endpoint_used = "scrape";
      const result = await scrapeSinglePage(hub.hub_url, firecrawlKey);
      firecrawl_http_status = result.httpStatus;
      if (!result.ok) {
        firecrawl_error_snippet = result.errorSnippet;
        const { status: errStatus, backoffKey } = classifyError(result.httpStatus, result.rawData);
        const backoff = new Date(Date.now() + cfg[backoffKey] * 60 * 1000).toISOString();
        await supabase.from("source_hubs").update({
          last_crawled_at: new Date().toISOString(), status: errStatus,
          error: (result.errorSnippet ?? "Scrape failed").slice(0, 1000),
          consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff,
        }).eq("id", hubId);
        await releaseLock();
        return makeResult({ hub_url: hub.hub_url, status: errStatus, urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0 });
      }
      allLinks = result.links;
    } else {
      // ── Crawl Mode ──
      firecrawl_endpoint_used = "crawl";
      const hubDepth = computeUrlPathDepth(hub.hub_url);
      const baseMaxDepth = hub.crawl_depth_override ?? cfg.firecrawl_maxDepth;
      const effectiveMaxDepth = Math.max(baseMaxDepth, hubDepth + 2);
      const maxPages = hub.crawl_pages_override ?? cfg.firecrawl_maxPages;

      console.log(`Hub path depth=${hubDepth}, effectiveMaxDepth=${effectiveMaxDepth}`);

      const crawlRes = await fetch(`${FIRECRAWL_API}/crawl`, {
        method: "POST",
        headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: hub.hub_url, limit: maxPages, maxDepth: effectiveMaxDepth, scrapeOptions: { formats: ["links"] } }),
      });
      firecrawl_http_status = crawlRes.status;
      const crawlData = await crawlRes.json();

      if (!crawlRes.ok) {
        const { status: errStatus } = classifyError(crawlRes.status, crawlData);

        // ── Depth exceeded fallback: retry with single_page scrape ──
        if (errStatus === "depth_exceeded") {
          console.log(`Depth exceeded for ${hub.hub_url}, falling back to single_page scrape`);
          firecrawl_mode_used = "single_page_fallback";
          firecrawl_endpoint_used = "scrape";
          const fallback = await scrapeSinglePage(hub.hub_url, firecrawlKey);
          firecrawl_http_status = fallback.httpStatus;
          if (fallback.ok) {
            allLinks = fallback.links;
            finalStatus = "ok_fallback_single_page";
          } else {
            firecrawl_error_snippet = fallback.errorSnippet;
            const backoff = new Date(Date.now() + cfg.general_backoff_minutes * 60 * 1000).toISOString();
            await supabase.from("source_hubs").update({
              last_crawled_at: new Date().toISOString(), status: "failed",
              error: (fallback.errorSnippet ?? "Fallback scrape failed").slice(0, 1000),
              consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff,
            }).eq("id", hubId);
            await releaseLock();
            return makeResult({ hub_url: hub.hub_url, status: "failed", urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0 });
          }
        } else {
          firecrawl_error_snippet = extractErrorSnippet(crawlData);
          const { backoffKey } = classifyError(crawlRes.status, crawlData);
          const backoff = new Date(Date.now() + cfg[backoffKey] * 60 * 1000).toISOString();
          await supabase.from("source_hubs").update({
            last_crawled_at: new Date().toISOString(), status: errStatus,
            error: extractErrorSnippet(crawlData).slice(0, 1000),
            consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff,
          }).eq("id", hubId);
          await releaseLock();
          return makeResult({ hub_url: hub.hub_url, status: errStatus, urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0 });
        }
      } else {
        // Poll for crawl completion
        const crawlId = crawlData.id;
        if (!crawlId) throw new Error("No crawl ID");

        let completed = false;
        const deadline = Date.now() + 5 * 60 * 1000;
        while (!completed && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 5000));
          const res = await fetch(`${FIRECRAWL_API}/crawl/${crawlId}`, { headers: { Authorization: `Bearer ${firecrawlKey}` } });
          firecrawl_http_status = res.status;
          const data = await res.json();
          if (data.status === "completed") {
            completed = true;
            for (const page of (data.data ?? [])) {
              allLinks.push(...(page.links ?? []));
              if (page.metadata?.sourceURL) allLinks.push(page.metadata.sourceURL);
            }
          } else if (data.status === "failed") {
            const errSnippet = extractErrorSnippet(data);
            const { status: errStatus } = classifyError(null, data);

            // Fallback on depth_exceeded during poll too
            if (errStatus === "depth_exceeded") {
              console.log(`Crawl failed with depth_exceeded during poll, falling back to scrape`);
              firecrawl_mode_used = "single_page_fallback";
              firecrawl_endpoint_used = "scrape";
              const fallback = await scrapeSinglePage(hub.hub_url, firecrawlKey);
              firecrawl_http_status = fallback.httpStatus;
              if (fallback.ok) {
                allLinks = fallback.links;
                finalStatus = "ok_fallback_single_page";
                completed = true;
              } else {
                firecrawl_error_snippet = fallback.errorSnippet;
                const backoff = new Date(Date.now() + cfg.general_backoff_minutes * 60 * 1000).toISOString();
                await supabase.from("source_hubs").update({
                  last_crawled_at: new Date().toISOString(), status: "failed",
                  error: (fallback.errorSnippet ?? "Fallback scrape failed").slice(0, 1000),
                  consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff,
                }).eq("id", hubId);
                await releaseLock();
                return makeResult({ hub_url: hub.hub_url, status: "failed", urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0 });
              }
            } else {
              firecrawl_error_snippet = errSnippet;
              const { backoffKey } = classifyError(null, data);
              const backoff = new Date(Date.now() + cfg[backoffKey] * 60 * 1000).toISOString();
              await supabase.from("source_hubs").update({
                last_crawled_at: new Date().toISOString(), status: errStatus,
                error: errSnippet.slice(0, 1000), consecutive_failures: (hub.consecutive_failures ?? 0) + 1, next_crawl_at: backoff,
              }).eq("id", hubId);
              await releaseLock();
              return makeResult({ hub_url: hub.hub_url, status: errStatus, urls_discovered: 0, urls_after_filter: 0, urls_queued: 0, urls_skipped_duplicates: 0 });
            }
          }
        }
        if (!completed) throw new Error("Crawl timed out after 5 minutes");
      }
    }

    // ── Filter pipeline ──
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

    await supabase.from("source_hubs").update({
      last_crawled_at: new Date().toISOString(), status: finalStatus, error: null,
      consecutive_failures: 0, next_crawl_at: null,
    }).eq("id", hubId);

    await releaseLock();
    console.log(`Rerun hub complete: discovered=${urlsDiscovered}, filtered=${urlsAfterFilter}, queued=${toQueue.length}`);
    return makeResult({
      hub_url: hub.hub_url, status: finalStatus,
      urls_discovered: urlsDiscovered, urls_after_filter: urlsAfterFilter,
      urls_queued: toQueue.length, urls_skipped_duplicates: urlsSkipped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Rerun hub ${hubId} failed:`, msg);
    const { data: hub } = await supabase.from("source_hubs").select("consecutive_failures").eq("id", hubId).maybeSingle();
    const backoff = new Date(Date.now() + DEFAULTS.general_backoff_minutes * 60 * 1000).toISOString();
    await supabase.from("source_hubs").update({
      last_crawled_at: new Date().toISOString(), status: "failed",
      error: msg.slice(0, 1000),
      consecutive_failures: ((hub?.consecutive_failures as number) ?? 0) + 1,
      next_crawl_at: backoff,
    }).eq("id", hubId);
    await releaseLock();
    return makeResult({ success: false, hub_id: hubId, error: msg });
  }
});
