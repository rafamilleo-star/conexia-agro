// api/track-crm-event.js
// Substitui as chamadas diretas do frontend a MAKE_WEBHOOK (hardcoded em
// src/App.jsx). O navegador nunca mais vê a URL do webhook Make — ele chama
// esta rota, e é o backend quem repassa para o Make usando MAKE_WEBHOOK_URL
// (variável de ambiente Vercel).
//
// Eventos aceitos: novo_contato, nova_interacao, onboarding (mesmos 3 eventos
// que já existiam no frontend — ver histórico de src/App.jsx). Qualquer outro
// valor de `event` é rejeitado para não virar um proxy genérico e aberto.

const ALLOWED_EVENTS = new Set(["novo_contato", "nova_interacao", "onboarding"]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
  if (!MAKE_WEBHOOK_URL) {
    // Não derruba o fluxo do usuário por falta de configuração — só loga.
    console.warn("[track-crm-event] MAKE_WEBHOOK_URL ausente no ambiente");
    return res.status(200).json({ ok: false, skipped: true });
  }

  try {
    const body = req.body || {};
    const { event } = body;

    if (!event || !ALLOWED_EVENTS.has(event)) {
      return res.status(400).json({ ok: false, error: "event inválido ou ausente" });
    }
    // userId é obrigatório para descartar chamadas totalmente arbitrárias.
    if (!body.userId) {
      return res.status(400).json({ ok: false, error: "userId ausente" });
    }

    const upstream = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Repassa sucesso/erro sem vazar detalhes da URL upstream para o cliente.
    return res.status(200).json({ ok: upstream.ok });
  } catch (e) {
    console.warn("[track-crm-event]", e?.message || e);
    // Nunca bloqueia a experiência do usuário por falha no push analítico.
    return res.status(200).json({ ok: false, error: "push falhou" });
  }
}
