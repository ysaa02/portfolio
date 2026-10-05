// Cloudflare Worker: serves the static site and answers /api/chat with Gemini.
// The Gemini key is a Worker secret (GEMINI_API_KEY); it never reaches the browser.
import { ABUSE_REPLY, SECTIONS, buildSystemPrompt } from "./portfolio";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  CHAT_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;
  DB?: { prepare(query: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };
}
interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

type Message = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 12; // conversation turns sent to the model
const MAX_CHARS = 500; // per message
const SYSTEM_PROMPT = buildSystemPrompt();
// Gemini's own filters; a blocked prompt or reply gets the fixed ABUSE_REPLY. Harassment only blocks "high":
// at "medium" it still blocked about 1 in 8 plain "How can I contact her?" questions. The prompt rules refuse insults.
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];
const SECTION_TAG = /\[section:\s*([a-z-]+)\s*\]/gi;
const EMPTY_REPLY = "Sorry, I couldn't come up with an answer to that. Try asking about her projects, skills or how to contact her.";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Only the site itself may call the API. Local origins are allowed for development.
function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const { hostname } = new URL(origin);
  return origin === new URL(request.url).origin || hostname === "127.0.0.1" || hostname === "localhost";
}

function parseMessages(body: unknown): Message[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) return null;
  const messages = (body as { messages: unknown[] }).messages
    .filter((m): m is Message =>
      !!m && typeof m === "object" &&
      ((m as Message).role === "user" || (m as Message).role === "assistant") &&
      typeof (m as Message).content === "string" && (m as Message).content.trim() !== "")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }));
  return messages.length && messages[messages.length - 1].role === "user" ? messages : null;
}

// The model ends each reply with "[section: id]"; keep the id only if it names a real section.
function findSection(text: string): string | undefined {
  const id = [...text.matchAll(SECTION_TAG)].map((m) => m[1].toLowerCase()).at(-1);
  return id && SECTIONS.includes(id) ? id : undefined;
}

type Chunk = {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};
// Events sent to the browser, one JSON object per line:
// {"text"} a piece of the reply · {"replace"} swap the whole reply (safety refusal) · {"done", "section"?} · {"error"}
type Event = { text: string } | { replace: string } | { done: true; section?: string } | { error: string };

// Question log: the visitor's latest question only, with emails and phone numbers masked. Refusals aren't kept.
function logQuestion(env: Env, question: string, section?: string): Promise<unknown> {
  if (!env.DB) return Promise.resolve();
  const clean = question
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]");
  return env.DB.prepare("INSERT INTO questions (question, section) VALUES (?, ?)")
    .bind(clean, section ?? null)
    .run()
    .catch((err) => console.error("question log:", err));
}

// Streams the reply; onDone gets the section once the answer is complete (not called for refusals or errors).
async function askGemini(env: Env, messages: Message[], onDone: (section?: string) => void): Promise<Response> {
  const request = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        safetySettings: SAFETY_SETTINGS,
        generationConfig: { maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(20000),
    });
  // Gemini sometimes answers 503 "high demand" for a moment; one retry after a short pause usually succeeds.
  let res = await request();
  if (res.status === 503 || res.status === 500) {
    await new Promise((r) => setTimeout(r, 800));
    res = await request();
  }
  if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const upstream = res.body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const reader = upstream.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "", all = "", sent = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop()!;
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const chunk = JSON.parse(line.slice(5)) as Chunk;
            const candidate = chunk.candidates?.[0];
            if (chunk.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY") {
              send({ replace: ABUSE_REPLY });
              send({ done: true });
              return;
            }
            all += (candidate?.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join("");
            // Hold back everything from the first "[" on: it may be the start of the section tag.
            const bracket = all.indexOf("[", sent);
            const safe = bracket === -1 ? all.length : bracket;
            if (safe > sent) {
              send({ text: all.slice(sent, safe) });
              sent = safe;
            }
          }
        }
        const rest = all.slice(sent).replace(SECTION_TAG, "").trimEnd();
        if (rest) send({ text: rest });
        if (!all.replace(SECTION_TAG, "").trim()) send({ replace: EMPTY_REPLY });
        const section = findSection(all);
        send({ done: true, section });
        if (all.replace(SECTION_TAG, "").trim() !== ABUSE_REPLY) onDone(section);
      } catch (err) {
        console.error(err);
        send({ error: "The answer was cut off. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

async function handleChat(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Forbidden." }, 403);

  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const { success } = await env.CHAT_LIMITER.limit({ key: ip });
  if (!success) return json({ error: "You're sending messages too quickly. Please wait a minute and try again." }, 429);

  if (!env.GEMINI_API_KEY) return json({ error: "The chat isn't set up yet." }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const messages = parseMessages(body);
  if (!messages) return json({ error: "Invalid request." }, 400);

  try {
    const question = messages[messages.length - 1].content;
    return await askGemini(env, messages, (section) => ctx.waitUntil(logQuestion(env, question, section)));
  } catch (err) {
    console.error(err);
    return json({ error: "The assistant is unavailable right now. Please try again later." }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") return handleChat(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
