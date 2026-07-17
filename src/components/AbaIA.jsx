import { useState, useEffect } from "react";
import { C } from "../utils/theme.js";
import { BRAND } from "../config/brand";

export function AbaIA({ userId, contacts, interactions, assessment, profile, pf, isPro, openAccessKey }) {
  const [secao, setSecao] = useState("insights");
  const [selContact, setSelContact] = useState(null);

  // ── Insights ──
  const [insights, setInsights] = useState(null);
  const [insLoading, setInsLoading] = useState(false);
  const [insErr, setInsErr] = useState(null);
  const [insRefresh, setInsRefresh] = useState(null);

  // ── Metas ──
  const [aiGoals, setAiGoals] = useState(null);
  const [metaDone, setMetaDone] = useState({});
  const [goalsLoading, setGoalsLoading] = useState(false);

  // ── Briefing ──
  const [briefing, setBriefing] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefErr, setBriefErr] = useState(null);

  const cacheKey = `${BRAND.storagePrefix}_ia_insights_${userId}`;
  const goalsKey = `${BRAND.storagePrefix}_ia_goals_${userId}`;
  const metaKey  = `${BRAND.storagePrefix}_ia_meta_${userId}`;

  const dSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

  useEffect(() => {
    if (!userId) return;
    try {
      const g = localStorage.getItem(goalsKey);
      if (g) setAiGoals(JSON.parse(g));
      const m = localStorage.getItem(metaKey);
      if (m) setMetaDone(JSON.parse(m));
    } catch(e) {}
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 4 * 60 * 60 * 1000) {
          setInsights(data);
          setInsRefresh(new Date(ts));
          return;
        }
      } catch(e) {}
    }
    if (contacts.length >= 3) generateInsights();
  }, [userId]);

  // ── Gerar Insights ──────────────────────────────────────
  const generateInsights = async () => {
    setInsLoading(true);
    setInsErr(null);
    try {
      const contactsDetail = contacts.map(c => {
        const cIts = interactions.filter(i => i.contactId === c.id || i.contact_id === c.id);
        const lastIt = [...cIts].sort((a,b) => new Date(b.createdAt||b.created_at) - new Date(a.createdAt||a.created_at))[0];
        const diasSemContato = lastIt ? dSince(lastIt.createdAt || lastIt.created_at) : null;
        const freqIdeal = c.idealFrequency || c.ideal_frequency || 30;
        const atrasado = diasSemContato !== null && diasSemContato > freqIdeal;
        return {
          nome: c.name, empresa: c.company||'', cargo: c.role||'',
          categoria: c.category||'', proximidade: c.proximity||3,
          saudeRelacional: c.health||0, status: c.status,
          proximaAcao: c.nextAction||c.next_action||null,
          proximaAcaoData: c.nextActionDate||c.next_action_date||null,
          influenciaPessoas: c.influenciaPessoas||c.influencia_pessoas,
          geraOportunidade: c.geraOportunidade||c.gera_oportunidade,
          abrePortas: c.abrePortas||c.abre_portas,
          momentoAtual: c.momentoAtual||c.momento_atual||null,
          totalInteracoes: cIts.length,
          interacoesPositivas: cIts.filter(i=>i.sentiment==='positivo'||i.sentiment==='positive').length,
          interacoesNegativas: cIts.filter(i=>i.sentiment==='negativo'||i.sentiment==='negative').length,
          vezesMandouValor: cIts.filter(i=>i.valueGen||i.value_gen).length,
          diasSemContato, atrasadoNaFrequencia: atrasado,
          diasDeAtraso: atrasado ? diasSemContato - freqIdeal : 0,
          ultimaInteracaoTipo: lastIt?.type||null,
          ultimaInteracaoSentimento: lastIt?.sentiment||null,
        };
      });
      const sc = assessment?.scores||{};
      const ctx = {
        perfil: assessment?.profileName||assessment?.profileKey||'',
        scoreGeral: assessment?.overall||0,
        intencaoEstrategica: sc.intencao_estrategica||0,
        escutaRelacional: sc.escuta_relacional||0,
        presencaMercado: sc.presenca_mercado||0,
        reciprocidadeAtiva: sc.reciprocidade_ativa||0,
        ritualConsistencia: sc.ritual_consistencia||0,
        confiancaAutentica: sc.confianca_autentica||0,
        objetivo: profile?.objective||'',
        totalContatos: contacts.length,
        contatos: contactsDetail,
        atrasados: contactsDetail.filter(c=>c.atrasadoNaFrequencia).map(c=>({nome:c.nome,diasAtraso:c.diasDeAtraso,categoria:c.categoria})),
        semInteracao: contactsDetail.filter(c=>c.totalInteracoes===0).map(c=>c.nome),
        relacionamentosDeterirorando: contactsDetail.filter(c=>c.interacoesNegativas>0&&c.interacoesNegativas>=c.interacoesPositivas).map(c=>({nome:c.nome,negativas:c.interacoesNegativas,positivas:c.interacoesPositivas})),
        altoPotencialSemContato: contactsDetail.filter(c=>(c.influenciaPessoas||c.geraOportunidade||c.abrePortas)&&(c.diasSemContato===null||c.diasSemContato>14)).map(c=>({nome:c.nome,empresa:c.empresa,cargo:c.cargo,diasSemContato:c.diasSemContato})),
        semReciprocidade: contactsDetail.filter(c=>c.totalInteracoes>=3&&c.vezesMandouValor===0).map(c=>c.nome),
      };
      const prompt = `Você é um coach de inteligência relacional. Analise os dados reais desta rede e gere EXATAMENTE 3 insights poderosos e acionáveis.

DADOS DA REDE:
${JSON.stringify(ctx, null, 2)}

REGRAS OBRIGATÓRIAS:
- Use NOMES REAIS dos contatos (não diga "um contato", diga o nome)
- Cada insight deve ter UMA ação concreta: O QUÊ fazer, COM QUEM e QUANDO
- Cruze o assessment com os dados da rede (ex: reciprocidade baixa + contatos sem valor gerado = contradição)
- Priorize situações críticas: relacionamentos deteriorando, alto potencial sem contato, ações vencidas
- PROIBIDO ser genérico — seja específico e cirúrgico
- Urgência: "alta" = precisa agir hoje/essa semana, "media" = essa quinzena, "baixa" = esse mês

Responda APENAS com JSON válido:
{"insights":[{"titulo":"string","observacao":"string","acao":"string","urgencia":"alta|media|baixa"}]}
Sem texto extra.`;

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 700 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.insights?.length) {
        setInsights(parsed.insights);
        setInsRefresh(new Date());
        localStorage.setItem(cacheKey, JSON.stringify({ data: parsed.insights, ts: Date.now() }));
      } else {
        setInsErr('A IA não retornou insights válidos. Tente novamente.');
      }
    } catch(e) {
      setInsErr('Erro ao gerar insights: ' + e.message);
    }
    setInsLoading(false);
  };

  // ── Gerar Metas ─────────────────────────────────────────
  const generateGoals = async () => {
    if (!pf) return;
    setGoalsLoading(true);
    try {
      const sc = assessment?.scores||{};
      const prompt = `Você é um coach de networking estratégico. Gere EXATAMENTE 3 metas personalizadas para os próximos 90 dias.

PERFIL DO USUÁRIO:
- Perfil relacional: ${pf.name} — ${pf.tagline}
- Pontos fortes: ${pf.strengths?.join(', ')}
- Riscos: ${pf.risks?.join(', ')}
- Objetivo declarado: ${profile?.objective||'não informado'}
- Scores: Intenção Estratégica ${sc.intencao_estrategica||0}%, Presença de Mercado ${sc.presenca_mercado||0}%, Reciprocidade Ativa ${sc.reciprocidade_ativa||0}%
- Total de contatos: ${contacts.length}

REGRAS:
- Metas específicas, mensuráveis e com prazo (ex: "Realizar 2 reuniões com mentores até o final do mês 2")
- Baseadas nos pontos fracos do assessment e no perfil
- Progressivas: mês 1, mês 2, mês 3

Responda APENAS com JSON: {"goals":["meta 1","meta 2","meta 3"]}
Sem texto extra.`;
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 400 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.goals?.length) {
        setAiGoals(parsed.goals);
        localStorage.setItem(goalsKey, JSON.stringify(parsed.goals));
      }
    } catch(e) {}
    setGoalsLoading(false);
  };

  const toggleMeta = (key) => {
    const newMeta = { ...metaDone, [key]: !metaDone[key] };
    setMetaDone(newMeta);
    localStorage.setItem(metaKey, JSON.stringify(newMeta));
  };

  // ── Gerar Briefing ──────────────────────────────────────
  const generateBriefing = async (contact) => {
    setSelContact(contact);
    setBriefing(null);
    setBriefErr(null);
    setBriefLoading(true);
    try {
      const cIts = interactions.filter(i => i.contactId === contact.id || i.contact_id === contact.id);
      const lastIt = [...cIts].sort((a,b) => new Date(b.createdAt||b.created_at) - new Date(a.createdAt||a.created_at))[0];
      const diasSemContato = lastIt ? dSince(lastIt.createdAt || lastIt.created_at) : null;
      const sc = assessment?.scores||{};
      const ctx = {
        contato: {
          nome: contact.name, empresa: contact.company||'', cargo: contact.role||'',
          categoria: contact.category||'', proximidade: contact.proximity||3,
          saudeRelacional: contact.health||0,
          proximaAcao: contact.nextAction||contact.next_action||null,
          proximaAcaoData: contact.nextActionDate||contact.next_action_date||null,
          comoConheceu: contact.howMet||contact.how_met||null,
          notas: contact.notes||null, cidade: contact.city||null,
          aniversario: contact.birthday||null,
          influenciaPessoas: contact.influenciaPessoas||contact.influencia_pessoas,
          geraOportunidade: contact.geraOportunidade||contact.gera_oportunidade,
          abrePortas: contact.abrePortas||contact.abre_portas,
          momentoAtual: contact.momentoAtual||contact.momento_atual||null,
          totalInteracoes: cIts.length,
          interacoesPositivas: cIts.filter(i=>i.sentiment==='positivo'||i.sentiment==='positive').length,
          interacoesNegativas: cIts.filter(i=>i.sentiment==='negativo'||i.sentiment==='negative').length,
          vezesMandouValor: cIts.filter(i=>i.valueGen||i.value_gen).length,
          diasSemContato,
          ultimaInteracaoTipo: lastIt?.type||null,
          ultimaInteracaoSentimento: lastIt?.sentiment||null,
          ultimaInteracaoNota: lastIt?.notes||lastIt?.note||null,
          historico: cIts.slice(0,5).map(i=>({ tipo: i.type, sentimento: i.sentiment, nota: i.notes||i.note||'', data: i.createdAt||i.created_at })),
        },
        usuario: {
          perfil: assessment?.profileName||assessment?.profileKey||'',
          objetivo: profile?.objective||'',
          reciprocidadeAtiva: sc.reciprocidade_ativa||0,
          presencaMercado: sc.presenca_mercado||0,
        }
      };
      const prompt = `Você é um coach de relacionamentos estratégicos. Gere um briefing completo para o usuário se preparar para o próximo contato com esta pessoa.

DADOS:
${JSON.stringify(ctx, null, 2)}

Gere o briefing em JSON com EXATAMENTE esta estrutura:
{
  "estado_relacionamento": "2-3 linhas sobre o estado atual do relacionamento, baseado no histórico real",
  "pontos_atencao": "alertas específicos baseados nos dados (interações negativas, ação vencida, longa ausência, etc.) — null se não houver",
  "gancho_entrada": "como abrir a conversa de forma natural e específica para esta pessoa",
  "objetivo_estrategico": "qual o resultado ideal deste contato, baseado na categoria e objetivos do usuário",
  "perguntas_poderosas": ["pergunta 1", "pergunta 2", "pergunta 3"],
  "proximo_passo": "ação concreta com prazo sugerido após este contato"
}
Sem texto extra. Seja específico e use os dados reais.`;

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 700 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.estado_relacionamento) {
        setBriefing(parsed);
      } else {
        setBriefErr('Não foi possível gerar o briefing. Tente novamente.');
      }
    } catch(e) {
      setBriefErr('Erro: ' + e.message);
    }
    setBriefLoading(false);
  };

  const urgColor = { alta: C.cor, media: C.amb, baixa: C.grn };

  // Bloqueio visual pra recursos PRO desta aba — mesmo padrão do ProLock usado
  // em outras partes do app (Teia, Plano de 4 semanas), só que local aqui porque
  // o ProLock original vive em App.jsx e não é exportado.
  const AiProLock = ({ title, desc }) => (
    <div style={{ background: "#161618", border: "1px solid #2a2825", borderRadius: 12, padding: 24, textAlign: "center", margin: "8px 0" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 700, color: "#e8e4da", marginBottom: 6 }}>{title}</div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: "#6a6460", lineHeight: 1.6, marginBottom: 16, maxWidth: 340, margin: "0 auto 16px" }}>{desc}</div>
      {openAccessKey && (
        <button onClick={openAccessKey} style={{ background: C.gold, color: "#0d0d0f", border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Desbloquear no PRO
        </button>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Inteligência IA</h2>
      <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Sua rede analisada pela IA — insights, metas e briefings personalizados.</p>

      {/* Tabs internas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: `1px solid ${C.brd}`, paddingBottom: 12 }}>
        {[
          { id: 'insights', label: '🧠 Insights' },
          { id: 'metas', label: '🎯 Metas 90 dias' },
          { id: 'briefing', label: '📋 Análise de Contato' },
        ].map(t => (
          <button key={t.id} onClick={() => setSecao(t.id)}
            style={{ background: secao === t.id ? C.gD : 'transparent', border: `1px solid ${secao === t.id ? C.gL : C.brd}`, borderRadius: 8, padding: '7px 14px', fontFamily: "'DM Sans'", fontSize: 12, fontWeight: secao === t.id ? 600 : 400, color: secao === t.id ? C.gold : C.txM, cursor: 'pointer', transition: 'all .2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SEÇÃO: INSIGHTS ── */}
      {secao === 'insights' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt }}>Análise inteligente da sua rede</div>
              {insRefresh && <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginTop: 2 }}>Atualizado às {insRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}
            </div>
            <button onClick={generateInsights} disabled={insLoading}
              style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 8, padding: '7px 16px', fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: C.gold, cursor: insLoading ? 'default' : 'pointer', opacity: insLoading ? 0.6 : 1 }}>
              {insLoading ? 'Analisando...' : '🔄 Atualizar'}
            </button>
          </div>
          {contacts.length < 3 && (
            <div style={{ background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 10, padding: 16, fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>
              Cadastre pelo menos 3 contatos para ativar os insights de IA.
            </div>
          )}
          {insLoading && (
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, textAlign: 'center', padding: '32px 0' }}>
              🧠 A IA está analisando sua rede...
            </div>
          )}
          {insErr && (
            <div style={{ background: `${C.cor}10`, border: `1px solid ${C.cor}30`, borderRadius: 10, padding: 12, fontFamily: "'DM Sans'", fontSize: 12, color: C.cor, marginBottom: 12 }}>
              ⚠️ {insErr}
            </div>
          )}
          {!insLoading && !insights && contacts.length >= 3 && !insErr && (
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txL, textAlign: 'center', padding: '24px 0' }}>
              Clique em "Atualizar" para gerar insights personalizados.
            </div>
          )}
          {insights && insights.map((ins, i) => {
            if (!isPro && i >= 1) return null; // Free vê só o primeiro insight — o resto fica atrás do bloqueio abaixo
            const uc = urgColor[ins.urgencia] || C.txL;
            return (
              <div key={i} style={{ background: `${uc}06`, border: `1px solid ${uc}20`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 4, background: uc, flexShrink: 0 }} />
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, flex: 1 }}>{ins.titulo}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 700, color: uc, textTransform: 'uppercase', letterSpacing: '.08em', background: `${uc}15`, padding: '2px 7px', borderRadius: 4 }}>{ins.urgencia}</div>
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6, marginBottom: 10 }}>{ins.observacao}</div>
                <div style={{ background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '.06em' }}>→ Ação: </span>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>{ins.acao}</span>
                </div>
              </div>
            );
          })}
          {insights && !isPro && insights.length > 1 && (
            <AiProLock
              title={`+${insights.length - 1} insight${insights.length - 1 > 1 ? 's' : ''} bloqueado${insights.length - 1 > 1 ? 's' : ''}`}
              desc="O Free mostra 1 insight por vez. No PRO, você vê a análise completa da sua rede, sempre atualizada."
            />
          )}
        </div>
      )}

      {/* ── SEÇÃO: METAS (PRO) ── */}
      {secao === 'metas' && !isPro && (
        <AiProLock
          title="Metas de 90 dias — recurso PRO"
          desc="Metas personalizadas, geradas pela IA a partir do seu perfil relacional e do seu assessment, com prazos progressivos por mês."
        />
      )}
      {secao === 'metas' && isPro && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt }}>Metas personalizadas para 90 dias</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginTop: 2 }}>Geradas com base no seu perfil e assessment</div>
            </div>
            <button onClick={generateGoals} disabled={goalsLoading || !pf}
              style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 8, padding: '7px 16px', fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: C.gold, cursor: goalsLoading || !pf ? 'default' : 'pointer', opacity: goalsLoading || !pf ? 0.6 : 1 }}>
              {goalsLoading ? 'Gerando...' : aiGoals ? '🔄 Regenerar' : '✨ Gerar com IA'}
            </button>
          </div>
          {!pf && (
            <div style={{ background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 10, padding: 16, fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>
              Complete o diagnóstico para gerar metas personalizadas.
            </div>
          )}
          {goalsLoading && (
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, textAlign: 'center', padding: '32px 0' }}>
              🎯 A IA está gerando suas metas...
            </div>
          )}
          {!goalsLoading && !aiGoals && pf && (
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txL, textAlign: 'center', padding: '24px 0' }}>
              Clique em "Gerar com IA" para receber metas personalizadas para o perfil <strong style={{ color: C.gold }}>{pf.name}</strong>.
            </div>
          )}
          {aiGoals && aiGoals.map((g, i) => (
            <div key={i} onClick={() => toggleMeta(`goal_${i}`)}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer', padding: '14px 16px', borderRadius: 12, background: metaDone[`goal_${i}`] ? `${C.grn}10` : C.card, border: `1px solid ${metaDone[`goal_${i}`] ? C.grn + '40' : C.brd}`, transition: 'all .2s' }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${metaDone[`goal_${i}`] ? C.grn : C.gL}`, background: metaDone[`goal_${i}`] ? C.grn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {metaDone[`goal_${i}`] && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.txL, textTransform: 'uppercase', marginBottom: 4 }}>Meta {i + 1}</div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 14, color: metaDone[`goal_${i}`] ? C.txL : C.txt, lineHeight: 1.5, textDecoration: metaDone[`goal_${i}`] ? 'line-through' : 'none' }}>{g}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SEÇÃO: BRIEFING (PRO) ── */}
      {secao === 'briefing' && !isPro && (
        <AiProLock
          title="Briefing pré-contato — recurso PRO"
          desc="Um resumo completo antes de cada reunião ou ligação: estado do relacionamento, pontos de atenção, gancho de conversa e próximo passo — gerado pela IA a partir do histórico real do contato."
        />
      )}
      {secao === 'briefing' && isPro && (
        <div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 4 }}>Briefing pré-contato</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 16 }}>Selecione um contato para receber um briefing completo antes de uma reunião ou ligação.</div>

          {/* Lista de contatos */}
          {!selContact && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contacts.length === 0 && (
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txL, textAlign: 'center', padding: '24px 0' }}>
                  Cadastre contatos para gerar briefings.
                </div>
              )}
              {contacts.map(c => (
                <button key={c.id} onClick={() => generateBriefing(c)}
                  style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', transition: 'border-color .2s' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${C.gold}20`, border: `1px solid ${C.gL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 700, color: C.gold, flexShrink: 0 }}>
                    {c.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt }}>{c.name}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{c.company||''}{c.role ? ` · ${c.role}` : ''}</div>
                  </div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, background: C.w06, padding: '3px 8px', borderRadius: 5 }}>{c.category||'—'}</div>
                  <span style={{ color: C.gold, fontSize: 14 }}>→</span>
                </button>
              ))}
            </div>
          )}

          {/* Briefing gerado */}
          {selContact && (
            <div>
              <button onClick={() => { setSelContact(null); setBriefing(null); setBriefErr(null); }}
                style={{ background: 'none', border: 'none', fontFamily: "'DM Sans'", fontSize: 12, color: C.txL, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Voltar para contatos
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px 16px', background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: `${C.gold}20`, border: `1px solid ${C.gL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans'", fontSize: 18, fontWeight: 700, color: C.gold }}>
                  {selContact.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 16, fontWeight: 700, color: C.txt }}>{selContact.name}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>{selContact.company||''}{selContact.role ? ` · ${selContact.role}` : ''}</div>
                </div>
              </div>

              {briefLoading && (
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, textAlign: 'center', padding: '32px 0' }}>
                  📋 Gerando briefing para {selContact.name}...
                </div>
              )}
              {briefErr && (
                <div style={{ background: `${C.cor}10`, border: `1px solid ${C.cor}30`, borderRadius: 10, padding: 12, fontFamily: "'DM Sans'", fontSize: 12, color: C.cor }}>
                  ⚠️ {briefErr}
                </div>
              )}
              {briefing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { key: 'estado_relacionamento', label: '📊 Estado do relacionamento', color: C.gold },
                    { key: 'pontos_atencao', label: '⚠️ Pontos de atenção', color: C.amb },
                    { key: 'gancho_entrada', label: '💬 Como abrir a conversa', color: C.grn },
                    { key: 'objetivo_estrategico', label: '🎯 Objetivo estratégico', color: C.gold },
                    { key: 'proximo_passo', label: '→ Próximo passo sugerido', color: C.grn },
                  ].filter(s => briefing[s.key]).map(s => (
                    <div key={s.key} style={{ background: `${s.color}06`, border: `1px solid ${s.color}20`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{s.label}</div>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt, lineHeight: 1.6 }}>{briefing[s.key]}</div>
                    </div>
                  ))}
                  {briefing.perguntas_poderosas?.length > 0 && (
                    <div style={{ background: `${C.gold}06`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>❓ Perguntas poderosas</div>
                      {briefing.perguntas_poderosas.map((q, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < briefing.perguntas_poderosas.length - 1 ? 10 : 0 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: C.gD, border: `1px solid ${C.gL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono'", fontSize: 11, fontWeight: 700, color: C.gold, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5 }}>{q}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
