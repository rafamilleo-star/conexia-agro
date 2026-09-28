/**
 * CONÉXIA — regras comuns da voz da Danna (OpenAI e Gemini).
 * Autenticação, acesso BETA para pagantes, logs de diagnóstico e de sessão.
 */

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function supabaseServer() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

// Diagnóstico: grava em public.danna_session_logs (service role).
export async function logDanna(stage, status, detail) {
  const sb = supabaseServer();
  if (!sb) return;
  try {
    await fetch(`${sb.url}/rest/v1/danna_session_logs`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stage: String(stage).slice(0, 80),
        status: Number.isFinite(status) ? status : null,
        detail: String(detail ?? "").slice(0, 4000),
      }),
    });
  } catch (_) {}
}

// Valida o token do Supabase enviado pelo app e devolve o usuário.
export async function getAuthUser(req) {
  const sb = supabaseServer();
  const auth = String(req.headers?.authorization || "");
  if (!sb || !auth.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(`${sb.url}/auth/v1/user`, {
      headers: { apikey: sb.key, Authorization: auth },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch (_) {
    return null;
  }
}

// Voz BETA: somente admin da plataforma ou assinatura paga ativa.
export async function hasPaidVoiceAccess(uid) {
  const sb = supabaseServer();
  if (!sb || !uid) return false;
  try {
    const r = await fetch(`${sb.url}/rest/v1/rpc/has_paid_voice_access`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid }),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch (_) {
    return false;
  }
}

const ALLOWED_MODELS = new Set(["gpt-live-1", "gemini-3.8-live"]);

// Grava a duração de uma sessão de voz em public.danna_sessions.
export async function recordSession(userId, body) {
  const sb = supabaseServer();
  if (!sb || !userId) return;
  const seconds = Math.max(0, Math.min(7200, Math.round(Number(body?.seconds) || 0)));
  const model = ALLOWED_MODELS.has(body?.model) ? body.model : "gpt-live-1";
  try {
    await fetch(`${sb.url}/rest/v1/danna_sessions`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        started_at:
          body?.started_at ||
          new Date(Date.now() - seconds * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        seconds,
        end_reason: String(body?.end_reason || "").slice(0, 40) || null,
        user_turns: Math.max(0, Math.round(Number(body?.user_turns) || 0)),
        model,
      }),
    });
  } catch (_) {}
}

// Nome de quem conversa: só letras, espaços, hífen e apóstrofo; até 40 caracteres.
export function sanitizeName(raw) {
  return String(raw || "")
    .normalize("NFC")
    .replace(/[^\p{L}\s'-]/gu, "")
    .trim()
    .slice(0, 40);
}
