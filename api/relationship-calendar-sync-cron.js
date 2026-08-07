// api/relationship-calendar-sync-cron.js
// Job: sync-calendar-ics
//
// Captura Passiva via Calendário (Bloco 2 + extensão de contato novo). Roda
// 1x/dia. Para cada usuário PRO com `calendar_ics_url` cadastrado, busca o
// .ics público (endereço secreto do Google Calendar, sem OAuth), extrai
// eventos das últimas 24h:
//
//   - se o convidado casa com um contato existente -> pergunta se registra
//     a interação (CALENDAR_INTERACTION_SUGGESTION);
//   - se não casa com ninguém, mas o evento parece uma reunião real
//     (poucos convidados, nome completo, e-mail não-automático) -> pergunta
//     se cadastra a pessoa E já registra a conversa, numa única pergunta
//     (CALENDAR_NEW_CONTACT_SUGGESTION) — sem criar tela de cadastro nova.
//
// As duas respostas (sim/não) são tratadas em whatsapp-webhook.js via
// whatsapp_pending_actions (mesmo mecanismo já usado por
// register_contact_missing_name).
//
// Feature PRO — mesmo gate de is_pro=true já usado em
// relationship-attention-cron.js.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { calendarInteractionSuggestionMessage, calendarNewContactSuggestionMessage } from './_lib/relationshipAssistant/messages.js';
import { parseICSEvents, eventsInWindow, matchContactToEvent, suggestNewContactFromEvent } from './_lib/relationshipAssistant/icsImport.js';
import { localDateISO } from './_lib/relationshipAssistant/timeWindow.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Mesmo padrão de whatsapp_pending_actions já usado em whatsapp-webhook.js —
// duplicado aqui (função pequena) em vez de importado, seguindo o mesmo
// padrão de sb() local já repetido em notificationLog.js/outros crons.
async function setPendingAction(userId, intent, data) {
  await sb(`whatsapp_pending_actions?user_id=eq.${userId}`, { method: 'DELETE' }).catch(() => {});
  await sb('whatsapp_pending_actions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, intent, data: data || {} }),
  }).catch((e) => console.error('[relationship-calendar-sync-cron] falha ao gravar pending action:', e.message));
}

async function fetchICS(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'text/calendar' } });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error('[relationship-calendar-sync-cron] falha ao buscar .ics:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const perfis = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro,calendar_ics_url&onboarding_completed=eq.true&whatsapp=not.is.null&is_pro=eq.true&calendar_ics_url=not.is.null`
    );

    let sugestoesEnviadas = 0, semMatch = 0, semEvento = 0, comErro = 0;

    for (const profile of perfis || []) {
      try {
        const icsText = await fetchICS(profile.calendar_ics_url);
        if (!icsText) { comErro++; continue; }

        const allEvents = parseICSEvents(icsText);
        const untilISO = new Date().toISOString();
        const sinceISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const recentEvents = eventsInWindow(allEvents, sinceISO, untilISO);
        if (!recentEvents.length) { semEvento++; continue; }

        const contacts = await sb(`contacts?user_id=eq.${profile.id}&select=id,name`);

        // Só a primeira sugestão do dia por usuário — sendProactiveNotification
        // já limita a 1 msg automática/dia, então parar na primeira sugestão
        // enviada evita gastar chamadas à toa tentando os demais eventos.
        let enviouAlgo = false;
        const todayISO = localDateISO(profile.timezone);

        for (const event of recentEvents) {
          const match = matchContactToEvent(event, contacts || []);

          if (match) {
            // Já existe interação registrada com esse contato hoje? Não
            // sugere de novo — evita pergunta redundante se o usuário já
            // registrou manualmente ou por outra via.
            const jaRegistrada = await sb(
              `interactions?user_id=eq.${profile.id}&contact_id=eq.${match.id}&created_at=gte.${todayISO}T00:00:00&select=id&limit=1`
            );
            if (jaRegistrada?.length) continue;

            const text = calendarInteractionSuggestionMessage({
              firstName: profile.first_name,
              contactName: match.name,
              eventSummary: event.summary,
            });
            const result = await sendProactiveNotification({
              profile,
              notificationType: 'CALENDAR_INTERACTION_SUGGESTION',
              scopeKey: event.uid || `${match.id}:${todayISO}`,
              text,
            });
            if (result.sent) {
              await setPendingAction(profile.id, 'calendar_interaction_suggestion', {
                contact_id: match.id,
                contact_name: match.name,
                event_summary: event.summary || null,
              });
              sugestoesEnviadas++;
              enviouAlgo = true;
              break; // 1 sugestão por usuário por execução
            }
            continue;
          }

          // Sem match — tenta sugerir CONTATO NOVO (convidado real, reunião
          // pequena, e-mail não-automático; nunca o próprio dono do calendário).
          const candidato = suggestNewContactFromEvent(event, {
            selfNameHints: [profile.first_name].filter(Boolean),
          });
          if (!candidato) continue;

          const text = calendarNewContactSuggestionMessage({
            firstName: profile.first_name,
            contactName: candidato.name,
            eventSummary: event.summary,
          });
          const result = await sendProactiveNotification({
            profile,
            notificationType: 'CALENDAR_NEW_CONTACT_SUGGESTION',
            scopeKey: event.uid || `${candidato.email || candidato.name}:${todayISO}`,
            text,
          });
          if (result.sent) {
            await setPendingAction(profile.id, 'calendar_new_contact_suggestion', {
              contact_name: candidato.name,
              contact_email: candidato.email || null,
              event_summary: event.summary || null,
            });
            sugestoesEnviadas++;
            enviouAlgo = true;
            break; // 1 sugestão por usuário por execução
          }
        }
        if (!enviouAlgo) semMatch++;
      } catch (err) {
        console.error('[relationship-calendar-sync-cron] erro no usuário', profile.id, err);
        comErro++;
      }
    }

    return res.status(200).json({ ok: true, avaliados: perfis?.length || 0, sugestoesEnviadas, semMatch, semEvento, comErro });
  } catch (err) {
    console.error('[relationship-calendar-sync-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
