import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";
const MAX_HUBS = 20;
const MAX_PAGES = 200;
const MAX_DEPTH = 2;

const INCLUDE_KEYWORDS = [
  "scholarship", "scholarships", "funding", "bursary", "bursaries",
  "grant", "grants", "award", "awards", "fellowships", "stipend",
];

const EXCLUDE_KEYWORDS = [
  "news", "events", "athletics", "faculty", "staff", "research-news",
  "press", "blog", "alumni", "donate", "jobs", "careers", "privacy",
  "terms", "sitemap",
];

function shouldIncludeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  const hasInclude = INCLUDE_KEYWORDS.some((kw) => lower.includes(kw));
  const hasExclude = EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw));
  return hasInclude && !hasExclude;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

  if (!firecrawlKey) {
    return new Response(
      JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Fetch eligible hubs
  const { data: hubs, error: hubsErr } = await supabase
    .from("source_hubs")
    .select("*")
    .eq("is_active", true)
    .or("last_crawled_at.is.null,last_crawled_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(MAX_HUBS);

  if (hubsErr) {
    return new Response(
      JSON.stringify({ success: false, error: hubsErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!hubs || hubs.length === 0) {
    return new Response(
      JSON.stringify({ success: true, hubs_processed: 0, urls_discovered: 0, urls_queued: 0, hubs_failed: 0, runtime_ms: Date.now() - start }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Pre-fetch existing URLs for deduplication
  const { data: existingQueue } = await supabase.from("url_queue").select("url");
  const { data: existingScholarships } = await supabase.from("scholarships").select("source_url");

  const existingUrls = new Set<string>();
  (existingQueue ?? []).forEach((r) => existingUrls.add(r.url));
  (existingScholarships ?? []).forEach((r) => { if (r.source_url) existingUrls.add(r.source_url); });

  let hubsProcessed = 0;
  let hubsFailed = 0;
  let totalDiscovered = 0;
  let totalQueued = 0;

  // 3. Process each hub
  for (const hub of hubs) {
    try {
      console.log(`Crawling hub: ${hub.hub_url}`);

      // Start crawl via Firecrawl
      const crawlRes = await fetch(`${FIRECRAWL_API}/crawl`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: hub.hub_url,
          limit: MAX_PAGES,
          maxDepth: MAX_DEPTH,
          scrapeOptions: { formats: ["links"] },
        }),
      });

      const crawlData = await crawlRes.json();

      if (!crawlRes.ok) {
        throw new Error(crawlData.error || `Firecrawl returned ${crawlRes.status}`);
      }

      // Firecrawl crawl returns an async job — poll for completion
      const crawlId = crawlData.id;
      if (!crawlId) {
        throw new Error("Firecrawl did not return a crawl ID");
      }

      // Poll for results (max 5 minutes)
      let completed = false;
      let allLinks: string[] = [];
      const pollDeadline = Date.now() + 5 * 60 * 1000;

      while (!completed && Date.now() < pollDeadline) {
        await new Promise((r) => setTimeout(r, 5000)); // wait 5s between polls

        const statusRes = await fetch(`${FIRECRAWL_API}/crawl/${crawlId}`, {
          headers: { Authorization: `Bearer ${firecrawlKey}` },
        });
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
          completed = true;
          // Collect links from all crawled pages
          const pages = statusData.data ?? [];
          for (const page of pages) {
            const pageLinks = page.links ?? [];
            allLinks.push(...pageLinks);
            // Also add the page URL itself
            if (page.metadata?.sourceURL) {
              allLinks.push(page.metadata.sourceURL);
            }
          }
        } else if (statusData.status === "failed") {
          throw new Error(statusData.error || "Crawl failed");
        }
        // otherwise still scraping — keep polling
      }

      if (!completed) {
        throw new Error("Crawl timed out after 5 minutes");
      }

      // Deduplicate raw links
      const uniqueLinks = [...new Set(allLinks)];
      totalDiscovered += uniqueLinks.length;

      // 4. Filter URLs
      const filtered = uniqueLinks.filter(shouldIncludeUrl);

      // 5. Dedupe against existing
      const newUrls = filtered.filter((u) => !existingUrls.has(u));

      // 6. Insert into url_queue
      if (newUrls.length > 0) {
        const rows = newUrls.map((url) => ({
          url,
          provider_type: hub.provider_type ?? null,
          provider_subtype: hub.provider_subtype ?? null,
          provider_name: hub.provider_name ?? null,
          status: "pending",
          attempts: 0,
          discovered_from: hub.id,
        }));

        // Insert in batches of 100 to avoid payload limits
        for (let i = 0; i < rows.length; i += 100) {
          const batch = rows.slice(i, i + 100);
          const { error: insertErr } = await supabase
            .from("url_queue")
            .upsert(batch, { onConflict: "url", ignoreDuplicates: true });

          if (insertErr) {
            console.error(`Insert error for hub ${hub.id}:`, insertErr.message);
          }
        }

        // Track newly queued for global dedup set
        newUrls.forEach((u) => existingUrls.add(u));
        totalQueued += newUrls.length;
      }

      // 7. Update hub status — success
      await supabase
        .from("source_hubs")
        .update({ last_crawled_at: new Date().toISOString(), status: "ok", error: null })
        .eq("id", hub.id);

      hubsProcessed++;
      console.log(`Hub ${hub.hub_url}: discovered ${uniqueLinks.length}, filtered ${filtered.length}, queued ${newUrls.length}`);
    } catch (err) {
      // Hub failed — record error, continue to next hub
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Hub ${hub.hub_url} failed:`, msg);

      await supabase
        .from("source_hubs")
        .update({ last_crawled_at: new Date().toISOString(), status: "failed", error: msg.slice(0, 500) })
        .eq("id", hub.id);

      hubsFailed++;
    }
  }

  const summary = {
    success: true,
    hubs_processed: hubsProcessed,
    urls_discovered: totalDiscovered,
    urls_queued: totalQueued,
    hubs_failed: hubsFailed,
    runtime_ms: Date.now() - start,
  };

  console.log("discover-from-hubs complete:", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
