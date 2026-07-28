// api/relationship-onboarding-cron.js
// Job: scan-incomplete-onboarding
//
// Cobre DUAS etapas distintas do funil de ativação, cada uma com sua própria
// mensagem (nunca usa o texto de "cadastro" pra falar de assessment, ou
// vice-versa — seria inventar/confundir o que realmente falta pra pessoa):
//
//   1) CADASTRO incompleto (onboarding_completed = false).
//      LIMITAÇÃO REAL: como `whatsapp` e `onboarding_completed=true` são
//      gravados juntos na mesma escrita (handleOnboard em src/App.jsx), não
//      existe hoje nenhum perfil com whatsapp preenchido E cadastro
//      incompleto ao mesmo tempo — ou seja, esta etapa nunca vai encontrar
//      ninguém enquanto o formulário salvar tudo de uma vez só. Mantido aqui
//      por segurança (não quebra nada, só nunca casa) e documentado pra não
//      passar a impressão de que "abandono de cadastro" está coberto por
//      WhatsApp — hoje só seria possível por e-mail, que não existe no
//      sistema.
//
//   2) ASSESSMENT incompleto (onboarding_completed = true, mas
//      assessment_completed != true). Esta é REAL e ACIONÁVEL: a pessoa já
//      tem WhatsApp cadastrado. Usa onboarding_completed_at pra medir tempo
//      parado (ver migration add_onboarding_completed_at — contas antigas
//      têm valor aproximado por created_at, contas novas têm o valor exato).

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { onboardingReminderMessage, assessmentReminderMessage } from './_lib/relationshipAssistant/messages.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
const FIRST_REMINDER_HOURS = Number(process.env.ONBOARDING_FIRST_REMINDER_HOURS || 24);
const SECOND_REMINDER_HOURS = Number(process.env.ONBOARDING_SECOND_REMINDER_HOURS || 96);

async function processStep({ candidatos, buildText, notificationType, secondCutoffField, secondCutoff, scopePrefix }) {
  let enviados = 0, pulados = 0;
  for (const profile of candidatos || []) {
    const step = profile[secondCutoffField] <= secondCutoff ? 'second' : 'first';
    const text = buildText(profile.first_name, step);
    const result = await sendProactiveNotification({
      profile,
      notificationType,
      scopeKey: `${scopePrefix}-${step}`, // ex.: "assessment-first" — nunca repete o mesmo lembrete da mesma etapa
      text,
    });
    if (result.sent) enviados++; else pulados++;
  }
  return { enviados, pulados };
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

    const now = Date.now();
    const firstCutoff = new Date(now - FIRST_REMINDER_HOURS * 3600000).toISOString();
    const secondCutoff = new Date(now - SECOND_REMINDER_HOURS * 3600000).toISOString();

    // Etapa 1: cadastro (ver limitação documentada acima — hoje sempre vazio,
    // mantido por segurança caso o formulário passe a salvar em 2 etapas no futuro).
    const candidatosCadastro = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,created_at&onboarding_completed=eq.false&whatsapp=not.is.null&created_at=lte.${firstCutoff}`
    );
    const rCadastro = await processStep({
      candidatos: candidatosCadastro,
      buildText: onboardingReminderMessage,
      notificationType: 'ONBOARDING_REMINDER',
      secondCutoffField: 'created_at',
      secondCutoff,
      scopePrefix: 'cadastro',
    });

    // Etapa 2: assessment (o caso real). assessment_completed pode ser
    // false ou null (contas antigas antes da coluna existir) — cobre os dois.
    const candidatosAssessment = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,onboarding_completed_at&onboarding_completed=eq.true&or=(assessment_completed.eq.false,assessment_completed.is.null)&whatsapp=not.is.null&onboarding_completed_at=lte.${firstCutoff}`
    );
    const rAssessment = await processStep({
      candidatos: candidatosAssessment,
      buildText: assessmentReminderMessage,
      notificationType: 'ONBOARDING_REMINDER',
      secondCutoffField: 'onboarding_completed_at',
      secondCutoff,
      scopePrefix: 'assessment',
    });

    return res.status(200).json({
      ok: true,
      cadastro: { avaliados: candidatosCadastro?.length || 0, ...rCadastro },
      assessment: { avaliados: candidatosAssessment?.length || 0, ...rAssessment },
    });
  } catch (err) {
    console.error('[relationship-onboarding-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
