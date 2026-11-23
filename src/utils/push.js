// Chave pública VAPID: pode ficar no código (é pública por desenho).
// A chave privada fica só nas variáveis de ambiente da Vercel.
export const VAPID_PUBLIC_KEY = 'BGj-H9sCdkZayyUV4e_LQoPXZHyNVjJAziLqKCUjWaoFdtLcB1RYsObjleqcrisfu_i5qEzoDpoPLnWYj7lBLwE';

export function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSuportado() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Pede permissão e inscreve o aparelho. Deve ser chamada a partir de um toque do usuário.
export async function ativarLembretes(accessToken) {
  if (!pushSuportado()) throw new Error('Seu navegador não suporta lembretes. No iPhone, adicione o app à tela de início e abra por lá.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permissão negada. Ative as notificações do app nas configurações do aparelho.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  }
  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Não foi possível ativar os lembretes agora.');
  return true;
}

export async function lembretesAtivos() {
  if (!pushSuportado()) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}
