// api/interaction-intent-classifier-cron.js
// Job: classify-interaction-intent
//
// Classifica cada interação em 3 dimensões comportamentais, numa única
// chamada de IA. É a única peça do CONÉXIA que usa IA para interpretar
// comportamento (não decisão) — tudo que consome essas tags depois
// (shared/relationshipPatternDetector.js, shared/dimensionObservation.js)
// é matemática determinística de agregação.
//
// AS 3 DIMENSÕES E POR QUE ELAS EXISTEM (nenhuma é invenção sem base):
//
// 1. intent: reativo (respondeu a algo que a pessoa trouxe) vs proativo
//    (puxou contato por conta própria). Alimenta RELATIONSHIPS_ONLY_WHEN_NEEDED
//    (padrão nº8 do prompt mestre, Fase 5).
//
// 2. value_direction: dando (ofereceu algo sem pedir nada em troca) vs
//    pedindo (buscou algo pra si) vs neutro. Base: Adam Grant (Wharton),
//    "Give and Take" — o estilo de reciprocidade "giver" (dar mais do
//    que se recebe) é o preditor comportamental mais forte de confiança
//    de longo prazo numa rede profissional, entre os 3 estilos estudados
//    (giver/taker/matcher). Alimenta a dimensão Autenticidade
//    (confianca_autentica) em shared/dimensionObservation.js.
//
// 3. personal: a conversa trouxe algo pessoal sobre a outra pessoa (vida,
//    família, momento atual, hobby) vs foi só assunto de negócio. Base:
//    Reis & Shaver, "perceived partner responsiveness" — o indicador
//    comportamental central de escuta relacional é o responsivo lembrar
//    e retomar o que a outra pessoa compartilhou sobre si, não só reagir
//    à última mensagem. Alimenta a dimensão Empatia (escuta_relacional)
//    em shared/dimensionObservation.js.
//
// Onde fica salvo: reaproveita `interactions.tags` (array de texto que já
// existe, nunca renderizado em nenhuma tela — confirmado antes de
// escrever este arquivo). Cada dimensão vira uma tag prefixada
// ("_intent:", "_value:", "_personal:") pra ficar distinguível de tags
// que o próprio usuário digita. Se algum dia as tags aparecerem na UI,
// qualquer tag começando com "_" deve ser filtrada antes de renderizar.
//
// Retroativo: roda em lote sobre TODAS as interações que ainda não têm as
// 3 tags (as já existentes incluídas), não só as novas.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET || '';

// Quantas interações classificar por execução. Gemini 2.5 Flash é rápido,
// mas o cron tem um teto de tempo de execução na Vercel — mantém a
// margem. Roda diariamente, absorve o backlog em poucos dias.
const BATCH_SIZE = 60;

// Abaixo disso o texto não carrega contexto suficiente pra inferir nada
// ("ok", "feito", "liguei") — marca direto como ambíguo/neutro sem gastar
// uma chamada de IA.
const MIN_DESCRIPTION_LENGTH = 12;

const VALID_INTENT = new Set(['reactive', 'proactive', 'ambiguous']);
const VALID_VALUE = new Set(['giving', 'asking', 'neutral']);
const VALID_PERSONAL = new Set(['personal', 'business', 'ambiguous']);

async function geminiClassify(description) {
  const prompt = `Classifique a interação abaixo entre um profissional de agronegócio e um contato da rede dele, em 3 dimensões.

Texto da interação: "${description}"

Responda EXATAMENTE 3 palavras separadas por vírgula, sem espaço, sem explicação, sem markdown, nesta ordem:

1) intenção — "reactive" se o profissional respondeu a algo que a outra pessoa trouxe (indicação, pedido, oferta, convite); "proactive" se ele puxou o contato por iniciativa própria; "ambiguous" se não dá pra saber.

2) direção do valor — "giving" se o profissional ofereceu algo à pessoa sem pedir nada em troca (indicação, ajuda, conteúdo útil, favor); "asking" se ele pediu ou buscou algo para si (favor, indicação, informação, venda); "neutral" se foi só manter contato, sem nenhum dos dois.

3) conteúdo pessoal — "personal" se a conversa trouxe algo pessoal sobre a vida da outra pessoa (família, momento pessoal, hobby, saúde, comemoração); "business" se foi só assunto profissional/comercial; "ambiguous" se não dá pra saber.

Exemplo de resposta válida: proactive,giving,personal`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 20, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const data = await res.json().catch(() => null);
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase();
    const [rawIntent, rawValue, rawPersonal] = text.split(',').map((t) => t.trim());

    return {
      intent: VALID_INTENT.has(rawIntent) ? rawIntent : 'ambiguous',
      value: VALID_VALUE.has(rawValue) ? rawValue : 'neutral',
      personal: VALID_PERSONAL.has(rawPersonal) ? rawPersonal : 'ambiguous',
    };
  } catch (err) {
    console.error('[interaction-intent-classifier-cron] falha no Gemini:', err.message);
    return null; // null = não marca nada, tenta de novo na próxima execução
  }
}

function hasAllTags(tags) {
  const list = Array.isArray(tags) ? tags : [];
  return (
    list.some((t) => String(t).startsWith('_intent:')) &&
    list.some((t) => String(t).startsWith('_value:')) &&
    list.some((t) => String(t).startsWith('_personal:'))
  );
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

    // Busca o conjunto completo antes de filtrar — não dá pra filtrar
    // "não tem todas as 3 tags" direto no PostgREST. O teto de 5000 é só
    // proteção contra crescimento descontrolado; a base atual tem ~450
    // linhas. Interações já classificadas no formato antigo (só
    // "_intent:", de antes desta atualização) são completadas com as 2
    // tags novas, não reclassificadas do zero.
    const all = await sb(
      `interactions?select=id,description,tags&order=created_at.asc&limit=5000`
    );

    const pending = (all || [])
      .filter((row) => !hasAllTags(row.tags))
      .slice(0, BATCH_SIZE);

    let classificadas = 0, puladas = 0, erros = 0;

    for (const row of pending) {
      const description = (row.description || '').trim();
      const existingTags = (Array.isArray(row.tags) ? row.tags : [])
        // Remove qualquer tag interna anterior incompleta antes de
        // reescrever — evita acumular versões antigas da mesma dimensão.
        .filter((t) => !String(t).startsWith('_intent:') && !String(t).startsWith('_value:') && !String(t).startsWith('_personal:'));

      let result;
      if (description.length < MIN_DESCRIPTION_LENGTH) {
        result = { intent: 'ambiguous', value: 'neutral', personal: 'ambiguous' };
        puladas++;
      } else {
        result = await geminiClassify(description);
        if (result === null) { erros++; continue; }
        classificadas++;
      }

      await sb(`interactions?id=eq.${row.id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({
          tags: [
            ...existingTags,
            `_intent:${result.intent}`,
            `_value:${result.value}`,
            `_personal:${result.personal}`,
          ],
        }),
      });
    }

    return res.status(200).json({
      ok: true,
      avaliadas: pending.length,
      classificadas,
      puladas,
      erros,
    });
  } catch (err) {
    console.error('[interaction-intent-classifier-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
