import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

// ── SAFE MODE defaults (configurable later) ──
const HUBS_PER_RUN = 3;
const FIRECRAWL_MAX_DEPTH = 1;
const FIRECRAWL_MAX_PAGES = 25;
const MAX_URLS_PER_HUB = 50;
const MAX_TOTAL_URLS_PER_RUN = 150;
const HUB_COOLDOWN_HOURS = 24;
const LOCK_DURATION_MINUTES = 15;
const JOB_NAME = "discover_from_hubs";

const INCLUDE_KEYWORDS = [
  "scholarship", "scholarships", "funding", "bursary", "bursaries",
  "grant", "grants", "award", "awards", "fellowship", "fellowships", "stipend",
];

const EXCLUDE_KEYWORDS = [
  "news", "event", "events", "athletics", "faculty", "staff",
  "press", "blog", "alumni", "donate", "jobs", "careers",
  "privacy", "terms", "sitemap",
];

function shouldIncludeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    INCLUDE_KEYWORDS.some((kw) => lower.includes(kw)) &&
    !EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw))
  );
}

function isRateLimitError(status: number, body: unknown): boolean {
  if (status === 429) return true;
  if (status === 409 || status === 503) return true;
  if (typeof body === "object" && body !== null) {
    const msg = JSON.stringify(body).toLowerCase();
    if (msg.includes("rate") || msg.includes("concurren") || msg.includes("queue")) return true;
  }
  return false;
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

  // ── A) Acquire job lock ──
  const { data: lockRow } = await supabase
    .from("job_locks")
    .select("*")
    .eq("job_name", JOB_NAME)
    .maybeSingle();

  const now = new Date();

  if (lockRow && new Date(lockRow.locked_until) > now) {
    return json({
      skipped: true,
      reason: "locked",
      locked_until: lockRow.locked_until,
      runtime_ms: Date.now() - start,
    });
  }

  // Set lock
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString();
  if (lockRow) {
    await supabase.from("job_locks").update({ locked_until: lockUntil, updated_at: now.toISOString() }).eq("job_name", JOB_NAME);
  } else {
    await supabase.from("job_locks").insert({ job_name: JOB_NAME, locked_until: lockUntil, updated_at: now.toISOString() });
  }

  // Helper to release lock
  const releaseLock = async () => {
    await supabase.from("job_locks").update({ locked_until: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("job_name", JOB_NAME);
  };

  try {
    // ── D) Select eligible hubs ──
    const cooldownCutoff = new Date(Date.now() - HUB_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const { data: hubs, error: hubsErr } = await supabase
      .from("source_hubs")
      .select("*")
      .eq("is_active", true)
      .or(`last_crawled_at.is.null,last_crawled_at.lt.${cooldownCutoff}`)
      .limit(HUBS_PER_RUN);

    if (hubsErr) {
      await releaseLock();
      return json({ success: false, error: hubsErr.message }, 500);
    }

    if (!hubs || hubs.length === 0) {
      await releaseLock();
      return json({
        skipped: false, hubs_selected: 0, hubs_processed: 0, hubs_ok: 0,
        hubs_failed: 0, hubs_queued_or_limited: 0, urls_discovered_total: 0,
        urls_queued_total: 0, urls_skipped_duplicates_total: 0, runtime_ms: Date.now() - start,
      });
    }

    // Pre-fetch existing URLs for dedup
    const { data: existingQueue } = await supabase.from("url_queue").select("url");
    const { data: existingScholarships } = await supabase.from("scholarships").select("source_url");
    const existingUrls = new Set<string>();
    (existingQueue ?? []).forEach((r) => existingUrls.add(r.url));
    (existingScholarships ?? []).forEach((r) => { if (r.source_url) existingUrls.add(r.source_url); });

    let hubsOk = 0;
    let hubsFailed = 0;
    let hubsLimited = 0;
    let urlsDiscoveredTotal = 0;
    let urlsQueuedTotal = 0;
    let urlsSkippedTotal = 0;
    let rateLimited = false;

    // ── B) Process hubs strictly sequentially ──
    for (const hub of hubs) {
      if (rateLimited) break;
      if (urlsQueuedTotal >= MAX_TOTAL_URLS_PER_RUN) break;

      try {
        console.log(`Crawling hub: ${hub.hub_url}`);

        // Start crawl
        const crawlRes = await fetch(`${FIRECRAWL_API}/crawl`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: hub.hub_url,
            limit: FIRECRAWL_MAX_PAGES,
            maxDepth: FIRECRAWL_MAX_DEPTH,
            scrapeOptions: { formats: ["links"] },
          }),
        });

        const crawlData = await crawlRes.json();

        // ── F) Rate limit detection ──
        if (!crawlRes.ok) {
          if (isRateLimitError(crawlRes.status, crawlData)) {
            const errMsg = `Rate/concurrency limited (HTTP ${crawlRes.status})`;
            console.warn(`Hub ${hub.hub_url}: ${errMsg}`);
            await supabase.from("source_hubs").update({
              last_crawled_at: new Date().toISOString(),
              status: "queued_or_limited",
              error: errMsg,
            }).eq("id", hub.id);
            hubsLimited++;
            rateLimited = true;
            break;
          }
          throw new Error(crawlData.error || `Firecrawl returned ${crawlRes.status}`);
        }

        const crawlId = crawlData.id;
        if (!crawlId) throw new Error("Firecrawl did not return a crawl ID");

        // Poll for results (max 5 min)
        let completed = false;
        let allLinks: string[] = [];
        const pollDeadline = Date.now() + 5 * 60 * 1000;

        while (!completed && Date.now() < pollDeadline) {
          await new Promise((r) => setTimeout(r, 5000));

          const statusRes = await fetch(`${FIRECRAWL_API}/crawl/${crawlId}`, {
            headers: { Authorization: `Bearer ${firecrawlKey}` },
          });
          const statusData = await statusRes.json();

          // Check rate limit on poll too
          if (!statusRes.ok && isRateLimitError(statusRes.status, statusData)) {
            const errMsg = `Rate limited during poll (HTTP ${statusRes.status})`;
            await supabase.from("source_hubs").update({
              last_crawled_at: new Date().toISOString(),
              status: "queued_or_limited",
              error: errMsg,
            }).eq("id", hub.id);
            hubsLimited++;
            rateLimited = true;
            break;
          }

          if (statusData.status === "completed") {
            completed = true;
            const pages = statusData.data ?? [];
            for (const page of pages) {
              const pageLinks = page.links ?? [];
              allLinks.push(...pageLinks);
              if (page.metadata?.sourceURL) allLinks.push(page.metadata.sourceURL);
            }
          } else if (statusData.status === "failed") {
            throw new Error(statusData.error || "Crawl failed");
          }
        }

        if (rateLimited) break;
        if (!completed) throw new Error("Crawl timed out after 5 minutes");

        // Deduplicate raw links
        const uniqueLinks = [...new Set(allLinks)];
        urlsDiscoveredTotal += uniqueLinks.length;

        // ── E) Filter + dedupe ──
        const filtered = uniqueLinks.filter(shouldIncludeUrl);
        const newUrls = filtered.filter((u) => !existingUrls.has(u));

        // Apply per-hub cap
        const capped = newUrls.slice(0, MAX_URLS_PER_HUB);
        // Apply per-run cap
        const remaining = MAX_TOTAL_URLS_PER_RUN - urlsQueuedTotal;
        const toQueue = capped.slice(0, remaining);
        const skipped = filtered.length - toQueue.length;
        urlsSkippedTotal += skipped > 0 ? skipped : (filtered.length - newUrls.length);

        // Insert into url_queue
        if (toQueue.length > 0) {
          const rows = toQueue.map((url) => ({
            url,
            provider_type: hub.provider_type ?? null,
            provider_subtype: hub.provider_subtype ?? null,
            provider_name: hub.provider_name ?? null,
            status: "pending",
            attempts: 0,
            discovered_from: hub.id,
          }));

          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const { error: insertErr } = await supabase
              .from("url_queue")
              .upsert(batch, { onConflict: "url", ignoreDuplicates: true });
            if (insertErr) {
              console.error(`Insert error for hub ${hub.id}:`, insertErr.message);
            }
          }

          toQueue.forEach((u) => existingUrls.add(u));
          urlsQueuedTotal += toQueue.length;
        }

        // ── G) Update hub — success ──
        await supabase.from("source_hubs").update({
          last_crawled_at: new Date().toISOString(),
          status: "ok",
          error: null,
        }).eq("id", hub.id);

        hubsOk++;
        console.log(`Hub ${hub.hub_url}: discovered ${uniqueLinks.length}, filtered ${filtered.length}, queued ${toQueue.length}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Hub ${hub.hub_url} failed:`, msg);
        await supabase.from("source_hubs").update({
          last_crawled_at: new Date().toISOString(),
          status: "failed",
          error: msg.slice(0, 500),
        }).eq("id", hub.id);
        hubsFailed++;
      }
    }

    // ── H) Return detailed summary ──
    const summary = {
      skipped: false,
      hubs_selected: hubs.length,
      hubs_processed: hubsOk + hubsFailed + hubsLimited,
      hubs_ok: hubsOk,
      hubs_failed: hubsFailed,
      hubs_queued_or_limited: hubsLimited,
      urls_discovered_total: urlsDiscoveredTotal,
      urls_queued_total: urlsQueuedTotal,
      urls_skipped_duplicates_total: urlsSkippedTotal,
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
