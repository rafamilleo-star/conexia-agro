// api/_lib/agendaWhatsapp.js
// Comandos da Agenda pessoal pelo WhatsApp. Roda antes da análise de intenção
// (Gemini) e só age em mensagens que começam com um comando conhecido:
//   "tarefa: pagar boleto"            → cria tarefa
//   "tarefa: pagar boleto 25/11"      → cria tarefa com prazo (dd/mm ou dd/mm/aaaa)
//   "tarefa: ligar pro cliente hoje"  → prazo de hoje; "amanhã" também funciona
//   "tarefas" ou "agenda"             → lista as tarefas abertas
//   "feita: boleto"                   → marca como feita a tarefa que contém o texto
// Usa a chave de serviço do Supabase, então TODA consulta filtra por user_id.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TZ = 'America/Sao_Paulo';

async function sbAgenda(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Data de hoje no fuso de São Paulo, em YYYY-MM-DD
function hojeISO(offsetDias = 0) {
  const agora = new Date();
  const base = new Date(agora.toLocaleString('en-US', { timeZone: TZ }));
  base.setDate(base.getDate() + offsetDias);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Extrai um prazo do fim do texto. Devolve { titulo, prazo } (prazo pode ser null).
function extrairPrazo(texto) {
  let t = texto.trim();
  const palavra = semAcento(t).match(/\s+(hoje|amanha)$/);
  if (palavra) {
    const prazo = palavra[1] === 'hoje' ? hojeISO(0) : hojeISO(1);
    return { titulo: t.slice(0, t.length - palavra[0].length).trim(), prazo };
  }
  const data = t.match(/\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (data) {
    const dia = data[1].padStart(2, '0');
    const mes = data[2].padStart(2, '0');
    let ano = data[3] ? data[3] : hojeISO(0).slice(0, 4);
    if (ano.length === 2) ano = '20' + ano;
    const prazo = `${ano}-${mes}-${dia}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || isNaN(new Date(prazo + 'T00:00:00').getTime())) {
      return { titulo: t, prazo: null };
    }
    return { titulo: t.slice(0, t.length - data[0].length).trim(), prazo };
  }
  return { titulo: t, prazo: null };
}

const formatData = (iso) => {
  if (!iso) return 'sem prazo';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

async function criarTarefa(userId, textoBruto) {
  const { titulo, prazo } = extrairPrazo(textoBruto);
  if (!titulo) return '✏️ Me diz o que é a tarefa. Exemplo: *tarefa: pagar boleto 25/11*';
  if (titulo.length > 200) return '✏️ A tarefa ficou longa demais. Tenta resumir em até 200 caracteres.';
  await sbAgenda('tasks_agenda', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, titulo, prazo, status: 'pendente', origem: 'whatsapp' }),
  });
  return `✅ Anotado na sua agenda: *${titulo}* (${formatData(prazo)}).`;
}

async function listarTarefas(userId) {
  const rows = await sbAgenda(
    `tasks_agenda?user_id=eq.${userId}&status=neq.feita&select=titulo,prazo,status&order=prazo.asc.nullslast,created_at.asc&limit=20`,
    { method: 'GET' }
  );
  if (!rows || rows.length === 0) return '📭 Sua agenda está vazia. Mande *tarefa: ...* para adicionar.';
  const hoje = hojeISO(0);
  const linhas = rows.map((r) => {
    const atrasada = r.prazo && r.prazo < hoje ? ' ⚠️ atrasada' : '';
    const emAndamento = r.status === 'em_andamento' ? ' (em andamento)' : '';
    return `• ${r.titulo} — ${formatData(r.prazo)}${atrasada}${emAndamento}`;
  });
  return `🗓️ *Suas tarefas abertas:*\n${linhas.join('\n')}\n\nPara concluir, mande *feita: parte do nome*.`;
}

async function concluirTarefa(userId, trecho) {
  const busca = semAcento(trecho);
  if (!busca) return '✏️ Diz qual tarefa concluir. Exemplo: *feita: boleto*';
  const abertas = await sbAgenda(
    `tasks_agenda?user_id=eq.${userId}&status=neq.feita&select=id,titulo&limit=200`,
    { method: 'GET' }
  );
  const achadas = (abertas || []).filter((t) => semAcento(t.titulo).includes(busca));
  if (achadas.length === 0) return `Não encontrei tarefa aberta com "${trecho}". Mande *tarefas* para ver a lista.`;
  if (achadas.length > 1) {
    return `Encontrei ${achadas.length} tarefas parecidas:\n${achadas.map((t) => `• ${t.titulo}`).join('\n')}\nMande um trecho mais específico.`;
  }
  const alvo = achadas[0];
  await sbAgenda(`tasks_agenda?id=eq.${alvo.id}&user_id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'feita', updated_at: new Date().toISOString() }),
  });
  return `🎉 Concluída: *${alvo.titulo}*.`;
}

// Devolve true se a mensagem era um comando da agenda (e já foi respondida).
export async function handleAgendaCommand({ userId, text, sendReply, number }) {
  if (!SUPABASE_SERVICE_KEY) return false;
  const bruto = String(text || '').trim();
  const sem = semAcento(bruto);
  let resposta = null;
  try {
    let m;
    if ((m = bruto.match(/^tarefa\s*:\s*([\s\S]+)$/i)) || (m = bruto.match(/^tarefa\s+([\s\S]+)$/i))) {
      resposta = await criarTarefa(userId, m[1]);
    } else if (/^(minhas\s+)?tarefas$/.test(sem) || sem === 'agenda') {
      resposta = await listarTarefas(userId);
    } else if ((m = bruto.match(/^(feita|feito|concluir)\s*:?\s+([\s\S]+)$/i))) {
      resposta = await concluirTarefa(userId, m[2]);
    } else {
      return false;
    }
  } catch (e) {
    console.error('agenda whatsapp erro', e?.message);
    resposta = '⚠️ Não consegui atualizar sua agenda agora. Tenta de novo em instantes.';
  }
  await sendReply(number, resposta);
  return true;
}
