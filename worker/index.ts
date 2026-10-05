// Cloudflare Worker: serves the static site and answers /api/chat with Gemini.
// The Gemini key is a Worker secret (GEMINI_API_KEY); it never reaches the browser.
import { ABUSE_REPLY, SECTIONS, buildSystemPrompt } from "./portfolio";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  CHAT_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;
}

type Message = { role: "user" | "assistant"; content: string };
type Reply = { reply: string; section?: string };

const MAX_MESSAGES = 12; // conversation turns sent to the model
const MAX_CHARS = 500; // per message
const SYSTEM_PROMPT = buildSystemPrompt();
// Gemini's own filters. Medium, because "low" also blocked plain questions like "How can I contact her?".
// A blocked prompt or reply gets the fixed ABUSE_REPLY.
const SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" }));
const SECTION_TAG = /\[section:\s*([a-z-]+)\s*\]/gi;

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

// The model ends each reply with "[section: id]"; strip it and keep the id only if it names a real section.
function splitSection(text: string): Reply {
  const ids = [...text.matchAll(SECTION_TAG)].map((m) => m[1].toLowerCase());
  const reply = text.replace(SECTION_TAG, "").trim();
  const section = ids.at(-1);
  return section && SECTIONS.includes(section) ? { reply, section } : { reply };
}

async function askGemini(env: Env, messages: Message[]): Promise<Reply> {
  const request = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
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
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY") return { reply: ABUSE_REPLY };
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("")
    .trim();
  const answer = splitSection(text);
  return answer.reply
    ? answer
    : { reply: "Sorry, I couldn't come up with an answer to that. Try asking about my projects, skills or how to contact me." };
}

async function handleChat(request: Request, env: Env): Promise<Response> {
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
    return json(await askGemini(env, messages));
  } catch (err) {
    console.error(err);
    return json({ error: "The assistant is unavailable right now. Please try again later." }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") return handleChat(request, env);
    return env.ASSETS.fetch(request);
  },
};
