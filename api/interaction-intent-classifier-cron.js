// api/interaction-intent-classifier-cron.js
// Job: classify-interaction-intent
//
// Classifica cada interação como reativa (usuário respondeu a algo que a
// outra pessoa trouxe: indicação, pedido, oferta) ou proativa (usuário
// puxou o contato por conta própria, sem gatilho externo). É a única peça
// do pattern detector (Fase 5) que usa IA — todo o resto de
// shared/relationshipPatternDetector.js é matemática determinística sobre
// dados que já existem.
//
// Por que isso existe: RELATIONSHIPS_ONLY_WHEN_NEEDED (padrão nº8 do
// prompt mestre) só pode ser afirmado com segurança se houver um sinal de
// intenção por trás de cada interação — e nenhum campo hoje carrega isso.
// Em vez de pedir pro usuário preencher um campo novo (o que contraria a
// seção 8 do prompt mestre, "nunca obrigar formulário longo"), a
// classificação é inferida do texto que a pessoa já escreveu em
// `description` — o mesmo texto que ela digitou no app ou ditou no
// WhatsApp.
//
// Onde fica salvo: reaproveita `interactions.tags` (array de texto que já
// existe, hoje editável pelo usuário no formulário de interação, mas
// nunca renderizado de volta em nenhuma tela — confirmado antes de
// escrever este arquivo). O resultado entra como uma tag prefixada com
// "_intent:" (ex: "_intent:reactive") para ficar claramente distinguível
// de tags que o próprio usuário digita. Se algum dia as tags passarem a
// aparecer na UI, qualquer tag começando com "_" deve ser filtrada antes
// de renderizar.
//
// Retroativo: roda em lote sobre TODAS as interações sem essa tag ainda
// (as 446 já existentes incluídas), não só as novas — por isso o limite
// de lote por execução, pra não estourar tempo/custo do cron de uma vez.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET || '';

// Quantas interações classificar por execução. Gemini 2.5 Flash é rápido,
// mas o cron tem um teto de tempo de execução na Vercel — mantém a
// margem. Como o cron roda diariamente, o backlog de 446 interações
// existentes é absorvido em poucos dias sem risco de timeout.
const BATCH_SIZE = 60;

// Abaixo disso o texto não carrega contexto suficiente pra inferir
// intenção ("ok", "feito", "liguei") — marca direto como ambíguo sem
// gastar uma chamada de IA. Evita tanto custo desnecessário quanto uma
// classificação inventada em cima de quase nada.
const MIN_DESCRIPTION_LENGTH = 12;

async function geminiClassify(description) {
  const prompt = `Classifique a interação abaixo entre um profissional de agronegócio e um contato da rede dele.

Texto da interação: "${description}"

Responda APENAS com uma palavra, sem explicação, sem pontuação, sem markdown:
- "reactive" se o profissional está respondendo a algo que a outra pessoa trouxe (indicação, pedido, oferta, convite, problema que o contato levantou).
- "proactive" se o profissional puxou o contato por iniciativa própria, sem gatilho externo evidente (ligou pra saber como a pessoa está, compartilhou algo, manteve presença).
- "ambiguous" se o texto não permite saber com segurança.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const data = await res.json().catch(() => null);
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase();
    if (text.includes('reactive')) return 'reactive';
    if (text.includes('proactive')) return 'proactive';
    return 'ambiguous';
  } catch (err) {
    console.error('[interaction-intent-classifier-cron] falha no Gemini:', err.message);
    return null; // null = não marca nada, tenta de novo na próxima execução
  }
}

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }
    if (!GEMINI_KEY) {
      return res.status(200).json({ ok: false, error: 'GEMINI_API_KEY ausente' });
    }

    // Busca o conjunto completo (id, description, tags) antes de filtrar.
    // Não dá pra filtrar "não contém tag com prefixo _intent:" direto no
    // PostgREST, então o filtro é client-side — por isso buscamos tudo em
    // vez de um LIMIT fixo já ordenado, senão a mesma fatia mais antiga
    // seria reconsultada pra sempre depois de já classificada, sem nunca
    // alcançar as interações mais novas. O teto de 5000 é só uma proteção
    // contra crescimento descontrolado; a base atual tem 446 linhas.
    const all = await sb(
      `interactions?select=id,description,tags&order=created_at.asc&limit=5000`
    );

    const pending = (all || [])
      .filter((row) => !(row.tags || []).some((t) => String(t).startsWith('_intent:')))
      .slice(0, BATCH_SIZE);

    let classificadas = 0, ambiguas = 0, puladas = 0, erros = 0;

    for (const row of pending) {
      const description = (row.description || '').trim();
      const existingTags = Array.isArray(row.tags) ? row.tags : [];

      let intent;
      if (description.length < MIN_DESCRIPTION_LENGTH) {
        intent = 'ambiguous';
        puladas++;
      } else {
        intent = await geminiClassify(description);
        if (intent === null) { erros++; continue; }
        if (intent === 'ambiguous') ambiguas++; else classificadas++;
      }

      await sb(`interactions?id=eq.${row.id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({ tags: [...existingTags, `_intent:${intent}`] }),
      });
    }

    return res.status(200).json({
      ok: true,
      avaliadas: pending.length,
      classificadas,
      ambiguas,
      puladas,
      erros,
    });
  } catch (err) {
    console.error('[interaction-intent-classifier-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
