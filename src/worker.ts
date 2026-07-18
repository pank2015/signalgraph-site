/**
 * Signalgraph site Worker (WS7). Serves the static site unchanged for every
 * route except /api/*, which handles the public "request a topic" feature.
 *
 * Human-in-the-loop preserved: this endpoint only ever creates a
 * `topic-request`-labeled GitHub issue on the engine repo. It never triggers
 * the engine and never touches `deep-dive` — the curator reviews the issue
 * and relabels it to `deep-dive` themselves to kick off the existing
 * deep-dive workflow. No email/subscriber storage (out of scope, see brief
 * §10): the optional email is only echoed into the issue body as contact
 * context, never persisted anywhere by this Worker.
 */

export interface Env {
  ASSETS: Fetcher;
  RATE_LIMIT: KVNamespace;
  GH_ISSUE_TOKEN: string;
  TURNSTILE_SECRET: string;
  SITE_ORIGIN: string;
  ENGINE_REPO: string; // "owner/name"
}

const MAX_TOPIC_CHARS = 200;
const MAX_DIRECTION_CHARS = 2000;
const MAX_EMAIL_CHARS = 254;
const RATE_LIMIT_PER_DAY = 5;
const RATE_LIMIT_TTL_SECONDS = 60 * 60 * 26; // a little over a day, so a UTC-boundary request never resets early

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

function cleanInput(value: unknown, maxChars: number): string {
  if (typeof value !== "string") return "";
  // Strip control characters (incl. newlines beyond what a single-line field
  // needs) and collapse whitespace; the GitHub issue body is markdown, not
  // HTML, so no HTML-escaping is needed — but a request field is not a place
  // for embedded formatting tricks either.
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxChars);
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function createTopicRequestIssue(env: Env, topic: string, direction: string, email: string): Promise<void> {
  const bodyLines = [
    `**Requested direction:**\n${direction}`,
    "",
    email ? `**Contact (optional, not stored — echoed here only):** ${email}` : "**Contact:** not provided",
    "",
    "_Submitted via the public \"request a topic\" form. This issue is inert until a curator adds the `deep-dive` label._",
  ];
  const res = await fetch(`https://api.github.com/repos/${env.ENGINE_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GH_ISSUE_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "signalgraph-site-worker",
    },
    body: JSON.stringify({ title: `Topic request: ${topic}`, body: bodyLines.join("\n"), labels: ["topic-request"] }),
  });
  if (!res.ok) {
    throw new Error(`GitHub issue create failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

async function handleRequestTopic(request: Request, env: Env): Promise<Response> {
  const origin = env.SITE_ORIGIN;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405, origin);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400, origin);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipKey = `rl:${await hashIp(ip)}:${new Date().toISOString().slice(0, 10)}`;
  const seen = Number((await env.RATE_LIMIT.get(ipKey)) || "0");
  if (seen >= RATE_LIMIT_PER_DAY) {
    return json({ ok: false, error: "rate limited — try again tomorrow" }, 429, origin);
  }

  const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";
  const turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!turnstileOk) return json({ ok: false, error: "turnstile verification failed" }, 400, origin);

  const topic = cleanInput(payload.topic, MAX_TOPIC_CHARS);
  const direction = cleanInput(payload.direction, MAX_DIRECTION_CHARS);
  const emailRaw = cleanInput(payload.email, MAX_EMAIL_CHARS);
  if (!topic || !direction) {
    return json({ ok: false, error: "topic and direction are required" }, 400, origin);
  }
  if (emailRaw && !isPlausibleEmail(emailRaw)) {
    return json({ ok: false, error: "email looks invalid — leave it blank if you'd rather not share it" }, 400, origin);
  }

  try {
    await createTopicRequestIssue(env, topic, direction, emailRaw);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "could not submit the request — try again later" }, 502, origin);
  }

  // Only increment on a request that actually reached GitHub successfully —
  // a Turnstile/validation failure shouldn't burn the submitter's daily quota.
  await env.RATE_LIMIT.put(ipKey, String(seen + 1), { expirationTtl: RATE_LIMIT_TTL_SECONDS });
  return json({ ok: true }, 200, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/request-topic") {
      return handleRequestTopic(request, env);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: "not found" }, 404, env.SITE_ORIGIN);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
