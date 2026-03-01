import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";
const JOB_NAME = "process_url_queue";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

type Settings = typeof DEFAULTS;

function loadSettings(row: Record<string, unknown> | null): Settings & { enabled: boolean } {
  if (!row) return { ...DEFAULTS, enabled: true };
  const s = (row.settings ?? {}) as Record<string, unknown>;
  return {
    enabled: (row.enabled as boolean) ?? true,
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
  };
}

function computeBackoff(attempts: number, base: number, max: number): number {
  return Math.min(base * Math.pow(2, attempts - 1), max);
}

async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

type NormalizeResult = { valid: true; url: string } | { valid: false; reason: string };

function normalizeUrl(raw: string): NormalizeResult {
  let s = raw.trim();
  if (!s) return { valid: false, reason: "empty_url" };

  // Reject non-http schemes
  const lc = s.toLowerCase();
  if (lc.startsWith("mailto:") || lc.startsWith("tel:") || lc.startsWith("javascript:") || lc.startsWith("data:") || lc.startsWith("ftp:")) {
    return { valid: false, reason: `rejected_scheme: ${lc.split(":")[0]}` };
  }

  // Protocol-relative
  if (s.startsWith("//")) s = "https:" + s;
  // Missing scheme but looks like a domain
  else if (!s.startsWith("http://") && !s.startsWith("https://")) {
    if (s.startsWith("www.") || s.includes(".")) {
      s = "https://" + s;
    } else {
      return { valid: false, reason: "no_valid_scheme_or_domain" };
    }
  }

  try {
    const u = new URL(s);
    u.hash = "";
    return { valid: true, url: u.href };
  } catch {
    return { valid: false, reason: `url_parse_failed: ${s.slice(0, 200)}` };
  }
}

async function callLLM(apiKey: string, messages: Array<{ role: string; content: string }>, tools?: unknown[], toolChoice?: unknown): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: "google/gemini-2.5-flash",
    messages,
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM error (${res.status}): ${errText.slice(0, 500)}`);
  }
  return await res.json();
}

async function classifyPage(apiKey: string, content: string): Promise<{ is_scholarship: boolean; confidence: number; reason: string }> {
  const tools = [{
    type: "function",
    function: {
      name: "classify_page",
      description: "Classify whether this page describes a specific scholarship opportunity.",
      parameters: {
        type: "object",
        properties: {
          is_scholarship: { type: "boolean", description: "True if the page describes a specific scholarship, fellowship, grant, or bursary opportunity with details. False for index pages, general financial aid info, news articles, or institutional pages." },
          confidence: { type: "number", description: "Confidence 0-1" },
          reason: { type: "string", description: "Brief reason for classification" },
        },
        required: ["is_scholarship", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  }];

  const truncated = content.slice(0, 8000);
  const result = await callLLM(apiKey, [
    { role: "system", content: "You classify web pages. Determine if this page describes a specific scholarship, fellowship, grant, or bursary opportunity. Index/listing pages with multiple scholarships should be classified as NOT a specific scholarship." },
    { role: "user", content: truncated },
  ], tools, { type: "function", function: { name: "classify_page" } });

  try {
    const msg = (result as any).choices[0].message;
    if (msg.tool_calls?.[0]) {
      return JSON.parse(msg.tool_calls[0].function.arguments);
    }
    return { is_scholarship: false, confidence: 0, reason: "No tool call returned" };
  } catch {
    return { is_scholarship: false, confidence: 0, reason: "Failed to parse classification" };
  }
}

async function extractScholarship(apiKey: string, content: string, sourceUrl: string): Promise<Record<string, unknown>> {
  const tools = [{
    type: "function",
    function: {
      name: "extract_scholarship",
      description: "Extract structured scholarship data from the page content.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Scholarship title" },
          description: { type: "string", description: "Description of the scholarship (max 2000 chars)" },
          amount: { type: "number", description: "Scholarship amount in the currency specified. Null if not stated." },
          currency: { type: "string", description: "3-letter currency code (e.g. USD, GBP, EUR)" },
          deadline: { type: "string", description: "Application deadline in YYYY-MM-DD format if available, else null" },
          tags: { type: "array", items: { type: "string" }, description: "Relevant tags like field of study, level (undergraduate, postgraduate), country" },
          eligibility_criteria: {
            type: "object",
            properties: {
              gpa: { type: "string" },
              nationality: { type: "string" },
              field_of_study: { type: "string" },
              level: { type: "string" },
              other: { type: "string" },
            },
          },
          is_active: { type: "boolean", description: "Whether the scholarship appears to be currently accepting applications" },
          confidence_score: { type: "number", description: "Your confidence in the accuracy of this extraction, 0-1" },
        },
        required: ["title", "confidence_score"],
        additionalProperties: false,
      },
    },
  }];

  const truncated = content.slice(0, 12000);
  const result = await callLLM(apiKey, [
    { role: "system", content: `You extract structured scholarship data from web pages. The source URL is: ${sourceUrl}. Extract all available fields accurately. If a field is not found, omit it. Be conservative with confidence_score.` },
    { role: "user", content: truncated },
  ], tools, { type: "function", function: { name: "extract_scholarship" } });

  try {
    const msg = (result as any).choices[0].message;
    if (msg.tool_calls?.[0]) {
      return JSON.parse(msg.tool_calls[0].function.arguments);
    }
    throw new Error("No tool call in extraction response");
  } catch (e) {
    throw new Error(`Extraction parse error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();
  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = new URL(req.url);
  const batchSizeOverride = url.searchParams.get("batch_size");
  const force = url.searchParams.get("force") === "true";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (!firecrawlKey) return json({ success: false, error: "FIRECRAWL_API_KEY not configured" }, 500);
  if (!lovableKey) return json({ success: false, error: "LOVABLE_API_KEY not configured" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Load settings ──
  const { data: agentRow } = await supabase
    .from("agent_settings")
    .select("*")
    .eq("agent_name", JOB_NAME)
    .maybeSingle();

  const cfg = loadSettings(agentRow);
  if (!cfg.enabled) return json({ skipped: true, reason: "disabled", runtime_ms: Date.now() - start });

  const batchSize = batchSizeOverride ? parseInt(batchSizeOverride, 10) : cfg.batch_size;

  // ── Job lock ──
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
    // ── Select pending URLs ──
    let query = supabase
      .from("url_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (!force) {
      const nowIso = new Date().toISOString();
      query = query.or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);
    }

    const { data: rows, error: selectErr } = await query;
    if (selectErr) {
      await releaseLock();
      return json({ success: false, error: selectErr.message }, 500);
    }

    if (!rows || rows.length === 0) {
      await releaseLock();
      return json({ skipped: false, selected: 0, processed: 0, inserted_or_updated: 0, ignored_not_scholarship: 0, failed: 0, retried: 0, runtime_ms: Date.now() - start });
    }

    // Counters
    let processed = 0, insertedOrUpdated = 0, ignoredNotScholarship = 0, failed = 0, retried = 0;
    let invalidUrlSkipped = 0, invalidUrlFirecrawlSkipped = 0;
    let lastError: string | null = null;

    for (const row of rows) {
      const rowId = row.id as string;
      const rawUrl = row.url as string;
      const attempts = (row.attempts as number) ?? 0;

      // Mark processing atomically
      const { error: lockErr } = await supabase
        .from("url_queue")
        .update({ status: "processing" })
        .eq("id", rowId)
        .eq("status", "pending");

      if (lockErr) {
        console.error(`Failed to lock row ${rowId}:`, lockErr.message);
        continue;
      }

      const normalized = normalizeUrl(rawUrl);

      // ── Invalid URL check ──
      if (!normalized.valid) {
        const errMsg = `invalid_url: ${normalized.reason} (raw: ${rawUrl.slice(0, 200)})`;
        console.warn(`Skipping invalid URL ${rowId}: ${errMsg}`);
        await supabase.from("url_queue").update({
          status: "failed",
          last_error: errMsg,
          processed_at: new Date().toISOString(),
          attempts: attempts + 1,
        }).eq("id", rowId);
        invalidUrlSkipped++;
        processed++;
        continue;
      }

      const normalizedUrl = normalized.url;

      try {
        // ── Scrape with Firecrawl ──
        console.log(`Scraping: ${normalizedUrl}`);
        const scrapeRes = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: normalizedUrl,
            formats: [cfg.firecrawl_format, "links"],
            onlyMainContent: true,
            timeout: cfg.firecrawl_timeout_ms,
          }),
        });

        const scrapeData = await scrapeRes.json();
        if (!scrapeRes.ok) {
          // Firecrawl 400 with invalid URL = permanent failure, no retry
          if (scrapeRes.status === 400) {
            const firecrawlErr = JSON.stringify(scrapeData).slice(0, 300);
            const errMsg = `invalid_url_firecrawl: ${normalizedUrl} — ${firecrawlErr}`;
            console.warn(`Firecrawl rejected URL ${rowId}: ${errMsg}`);
            await supabase.from("url_queue").update({
              status: "failed",
              last_error: errMsg,
              processed_at: new Date().toISOString(),
              attempts: attempts + 1,
            }).eq("id", rowId);
            invalidUrlFirecrawlSkipped++;
            processed++;
            continue;
          }
          throw new Error(`Firecrawl scrape error (${scrapeRes.status}): ${JSON.stringify(scrapeData).slice(0, 500)}`);
        }

        const data = scrapeData.data ?? scrapeData;
        const content = data.markdown || data.html || "";
        const finalUrl = data.metadata?.sourceURL || normalizedUrl;

        // ── Content length check ──
        if (content.length < cfg.min_text_length) {
          throw new Error("content_too_short");
        }

        // ── Classifier step ──
        if (cfg.use_classifier) {
          console.log(`Classifying: ${normalizedUrl}`);
          const classification = await classifyPage(lovableKey, content);

          if (!classification.is_scholarship || classification.confidence < cfg.classifier_min_confidence) {
            await supabase.from("url_queue").update({
              status: "failed",
              last_error: `not_a_scholarship_page: ${classification.reason}`,
              processed_at: new Date().toISOString(),
              attempts: attempts + 1,
            }).eq("id", rowId);

            ignoredNotScholarship++;
            processed++;
            continue;
          }
        }

        // ── Extraction step ──
        console.log(`Extracting: ${normalizedUrl}`);
        const extracted = await extractScholarship(lovableKey, content, finalUrl);

        if (!extracted.title) {
          throw new Error("extraction_missing_title");
        }

        if ((extracted.confidence_score as number) < cfg.extraction_min_confidence) {
          throw new Error(`extraction_low_confidence: ${extracted.confidence_score}`);
        }

        // ── Build scholarship record ──
        const contentHash = await hashContent(content);
        const providerType = (extracted.provider_type as string) || (row.provider_type as string) || "University";
        let providerSubtype = (extracted.provider_subtype as string) || (row.provider_subtype as string) || null;
        if (providerType === "External Agency" && !providerSubtype) {
          providerSubtype = "Other";
        }

        const scholarship = {
          title: extracted.title as string,
          description: (extracted.description as string) || null,
          amount: (extracted.amount as number) || null,
          currency: (extracted.currency as string) || cfg.default_currency,
          deadline: (extracted.deadline as string) || null,
          provider_name: (row.provider_name as string) || "Unknown",
          provider_type: providerType,
          provider_subtype: providerSubtype,
          source_url: finalUrl,
          tags: (extracted.tags as string[]) || null,
          eligibility_criteria: extracted.eligibility_criteria || null,
          is_active: (extracted.is_active as boolean) ?? true,
          content_hash: contentHash,
          last_verified_at: new Date().toISOString(),
          confidence_score: (extracted.confidence_score as number) || null,
        };

        // ── Upsert ──
        const { error: upsertErr } = await supabase
          .from("scholarships")
          .upsert(scholarship as any, { onConflict: "source_url" });

        if (upsertErr) {
          // If conflict resolution fails (no unique constraint on source_url), try insert
          if (upsertErr.message.includes("unique") || upsertErr.message.includes("constraint")) {
            const { error: updateErr } = await supabase
              .from("scholarships")
              .update(scholarship as any)
              .eq("source_url", finalUrl);
            if (updateErr) throw new Error(`Upsert failed: ${updateErr.message}`);
          } else {
            // Just insert without conflict
            const { error: insertErr } = await supabase
              .from("scholarships")
              .insert(scholarship as any);
            if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);
          }
        }

        // ── Mark done ──
        await supabase.from("url_queue").update({
          status: "done",
          processed_at: new Date().toISOString(),
          last_error: null,
          attempts: attempts + 1,
        }).eq("id", rowId);

        insertedOrUpdated++;
        processed++;

      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        lastError = errMsg.slice(0, 500);
        console.error(`Error processing ${normalizedUrl}:`, lastError);

        const newAttempts = attempts + 1;
        if (newAttempts >= cfg.max_attempts) {
          await supabase.from("url_queue").update({
            status: "failed",
            last_error: lastError,
            processed_at: new Date().toISOString(),
            attempts: newAttempts,
          }).eq("id", rowId);
          failed++;
        } else {
          const backoffMin = computeBackoff(newAttempts, cfg.backoff_minutes_base, cfg.backoff_minutes_max);
          const nextRunAt = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();
          await supabase.from("url_queue").update({
            status: "pending",
            last_error: lastError,
            attempts: newAttempts,
            next_run_at: nextRunAt,
          }).eq("id", rowId);
          retried++;
        }
        processed++;
      }
    }

    await releaseLock();

    return json({
      skipped: false,
      selected: rows.length,
      processed,
      inserted_or_updated: insertedOrUpdated,
      ignored_not_scholarship: ignoredNotScholarship,
      invalid_url_skipped: invalidUrlSkipped,
      invalid_url_firecrawl_skipped: invalidUrlFirecrawlSkipped,
      failed,
      retried,
      last_error: lastError,
      runtime_ms: Date.now() - start,
    });

  } catch (e) {
    await releaseLock();
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("process-url-queue fatal error:", errMsg);
    return json({ success: false, error: errMsg, runtime_ms: Date.now() - start }, 500);
  }
});
