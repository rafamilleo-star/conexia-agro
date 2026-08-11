// api/_lib/relationshipAssistant/oauthState.js
//
// O fluxo OAuth (Google/Outlook) é um redirect de página inteira — o
// callback do provedor não carrega o header Authorization da sessão
// Supabase. Pra saber de quem é o callback sem precisar de cookie/sessão
// server-side (que não existe nesse projeto — o Supabase client roda só no
// browser), assinamos o user_id no parâmetro `state` com HMAC, usando
// SUPABASE_SERVICE_KEY como segredo (já existe como env var, não precisa de
// mais nenhuma credencial nova pra isso funcionar).
//
// state = base64url(JSON{ uid, provider, ts }) + "." + HMAC-SHA256 hex

import { createHmac } from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_KEY || '';
const MAX_AGE_MS = 10 * 60 * 1000; // 10 min pra completar o consentimento

function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function b64urlDecode(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}
function sign(payloadB64) {
  return createHmac('sha256', SECRET).update(payloadB64).digest('hex');
}

export function createOAuthState({ uid, provider }) {
  const payload = b64urlEncode({ uid, provider, ts: Date.now() });
  return `${payload}.${sign(payload)}`;
}

// Retorna { uid, provider } ou lança erro se assinatura/prazo inválidos.
export function verifyOAuthState(state) {
  const [payloadB64, sig] = String(state || '').split('.');
  if (!payloadB64 || !sig) throw new Error('state malformado');
  if (sign(payloadB64) !== sig) throw new Error('state com assinatura inválida');
  const data = b64urlDecode(payloadB64);
  if (!data.ts || Date.now() - data.ts > MAX_AGE_MS) throw new Error('state expirado');
  if (!data.uid) throw new Error('state sem uid');
  return data;
}

// Verifica o access_token de sessão do Supabase (enviado pelo frontend no
// header Authorization) e retorna o user id — mesma anon key pública já
// hardcoded em src/utils/supabase.js (segura pra expor, é a chave anon).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvb3BvZ2ljZ3dxcW92bXBocXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDUxMDUsImV4cCI6MjA5NTIyMTEwNX0.-JMUl5-c1L6Hpf2i_blneSs1KAgZln8JBlBbt7Ql24o';

export async function getUserIdFromAuthHeader(authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id || null;
}
