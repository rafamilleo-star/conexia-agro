// CONÉXIA — Dados e constantes do sistema
// Perguntas extraídas do documento oficial: "CONÉXIA Assessment Completo"
// 12 Perguntas · 6 Dimensões · Múltipla escolha A/B/C/D

// Dimensões — índice corresponde ao campo `dim` em QS
// 0 = intencao_estrategica  (ESTRATÉGIA)
// 1 = escuta_relacional     (EMPATIA)
// 2 = presenca_mercado      (PRESENÇA)
// 3 = reciprocidade_ativa   (RECIPROCIDADE)
// 4 = ritual_consistencia   (CONSISTÊNCIA)
// 5 = confianca_autentica   (AUTENTICIDADE)

export const DIMS = [
  { key: "intencao_estrategica", label: "Estratégia",    short: "IE", color: "#C9A84C", icon: "◈", desc: "Clareza de intenção e visão sistêmica das relações profissionais" },
  { key: "escuta_relacional",    label: "Empatia",       short: "ER", color: "#5B9BD5", icon: "◉", desc: "Profundidade de escuta e inteligência interpessoal" },
  { key: "presenca_mercado",     label: "Presença",      short: "PM", color: "#70AD47", icon: "◎", desc: "Força de marca pessoal e impacto nas interações" },
  { key: "reciprocidade_ativa",  label: "Reciprocidade", short: "RA", color: "#ED7D31", icon: "⊛", desc: "Geração de valor genuíno nas trocas profissionais" },
  { key: "ritual_consistencia",  label: "Consistência",  short: "RC", color: "#9B59B6", icon: "⊕", desc: "Disciplina para nutrir relações ao longo do tempo" },
  { key: "confianca_autentica",  label: "Autenticidade", short: "CA", color: "#E74C3C", icon: "◍", desc: "Alinhamento entre valores e comportamento relacional" },
];

// Perguntas do assessment — 12 questões de múltipla escolha (A/B/C/D)
// scores: pontuação por letra (1–5) para cálculo da dimensão
// rev: true = pergunta reversa (pontuação invertida)
export const QS = [
  // ── ESTRATÉGIA (dim 0) ──────────────────────────────────────────────────
  {
    id: "p01", dim: 0,
    text: "Quando você imagina alguém com uma rede profissional extraordinária, o que mais te impressiona nessa pessoa?",
    opcoes: [
      { v: "A", l: "A clareza com que ela sabe o que quer e quem precisa conhecer" },
      { v: "B", l: "A forma como ela genuinamente se importa com quem está ao redor" },
      { v: "C", l: "O fato de todo mundo conhecê-la — ela é referência no setor" },
      { v: "D", l: "Como ela abre portas para outros, não apenas para si mesma" },
    ],
    scores: { A: 5, B: 3, C: 4, D: 4 },
  },
  {
    id: "p02", dim: 0,
    text: "Se alguém que acabou de te conhecer tivesse que te descrever para um colega amanhã, o que você gostaria que ele dissesse?",
    opcoes: [
      { v: "A", l: "\"É uma referência — sabe muito sobre o que faz e tem visão de mercado\"" },
      { v: "B", l: "\"É uma pessoa que te ouve de verdade e faz você pensar diferente\"" },
      { v: "C", l: "\"Tem uma presença marcante — você não esquece depois que conhece\"" },
      { v: "D", l: "\"É alguém que conecta pessoas e abre portas para outros\"" },
    ],
    scores: { A: 5, B: 3, C: 4, D: 4 },
  },

  // ── EMPATIA (dim 1) ─────────────────────────────────────────────────────
  {
    id: "p03", dim: 1,
    text: "Qual é a sua relação honesta com a ideia de fazer networking?",
    opcoes: [
      { v: "A", l: "Me energiza — adoro ambientes de troca e novas conexões" },
      { v: "B", l: "Me interessa, mas tenho dificuldade de manter o hábito" },
      { v: "C", l: "Faço por necessidade — reconheço a importância mas não é natural para mim" },
      { v: "D", l: "Prefiro relações profundas com poucos do que muitos contatos superficiais" },
    ],
    scores: { A: 4, B: 2, C: 2, D: 3 },
  },
  {
    id: "p04", dim: 1,
    text: "Em um evento com 200 pessoas do seu setor, como você geralmente se comporta após a primeira hora?",
    opcoes: [
      { v: "A", l: "Estou circulando ativamente — meu objetivo é falar com o máximo possível" },
      { v: "B", l: "Encontrei 2 ou 3 pessoas e entrei em conversas profundas" },
      { v: "C", l: "Estou observando estrategicamente antes de me aproximar de alguém" },
      { v: "D", l: "Provavelmente estou com quem já conheço — me sinto mais à vontade assim" },
    ],
    scores: { A: 4, B: 5, C: 3, D: 1 },
  },

  // ── PRESENÇA (dim 2) ────────────────────────────────────────────────────
  {
    id: "p05", dim: 2,
    text: "Alguém da sua rede pede sua ajuda em algo que vai te custar 2 horas. Sua primeira reação interna é:",
    opcoes: [
      { v: "A", l: "Ajudo sem pensar — gosto genuinamente de contribuir" },
      { v: "B", l: "Avalio se a relação justifica o investimento antes de responder" },
      { v: "C", l: "Ajudo, mas fico esperando que a reciprocidade venha naturalmente" },
      { v: "D", l: "Indico outra pessoa mais adequada — conheço meus limites e os de cada um" },
    ],
    scores: { A: 5, B: 2, C: 3, D: 4 },
  },
  {
    id: "p06", dim: 2,
    text: "Qual dessas situações mais te representa hoje?",
    opcoes: [
      { v: "A", l: "Tenho muitos contatos — mas poucos que eu chamaria de aliados reais" },
      { v: "B", l: "Tenho vínculos profundos, mas minha rede precisa crescer em volume e diversidade" },
      { v: "C", l: "Minha rede é diversificada e estrategicamente construída" },
      { v: "D", l: "Ainda estou construindo minha rede de forma mais intencional" },
    ],
    scores: { A: 2, B: 3, C: 5, D: 1 },
  },

  // ── RECIPROCIDADE (dim 3) ───────────────────────────────────────────────
  {
    id: "p07", dim: 3, rev: true,
    text: "Qual é o maior bloqueio que já impediu você de fazer networking com mais consistência?",
    opcoes: [
      { v: "A", l: "Falta de iniciativa — dificuldade de começar conversas e me apresentar com impacto" },
      { v: "B", l: "Falta de método — sei a importância, mas não sei como organizar" },
      { v: "C", l: "Tempo — tenho a intenção, mas a rotina engole" },
      { v: "D", l: "A sensação de estar pedindo algo ou sendo calculista" },
    ],
    scores: { A: 1, B: 2, C: 3, D: 3 },
  },
  {
    id: "p08", dim: 3,
    text: "Depois de uma conversa relevante com alguém novo, o que você costuma fazer nas 48 horas seguintes?",
    opcoes: [
      { v: "A", l: "Envio uma mensagem personalizada com algo de valor — artigo, contato, insight" },
      { v: "B", l: "Adiciono nas redes e aguardo que a relação evolua naturalmente" },
      { v: "C", l: "Espero uma oportunidade concreta para entrar em contato" },
      { v: "D", l: "Raramente faço follow-up — não me sinto confortável sendo 'interesseiro'" },
    ],
    scores: { A: 5, B: 3, C: 2, D: 1 },
  },

  // ── CONSISTÊNCIA (dim 4) ────────────────────────────────────────────────
  {
    id: "p09", dim: 4,
    text: "Quando você está em uma conversa importante com alguém de alto impacto, onde sua energia mais vai?",
    opcoes: [
      { v: "A", l: "Para entender profundamente quem essa pessoa é e o que ela vive" },
      { v: "B", l: "Para identificar onde posso gerar valor para ela agora ou no futuro" },
      { v: "C", l: "Para me posicionar bem — como estou sendo percebido, o que comunico" },
      { v: "D", l: "Para a qualidade da conexão — se há química e confiança real" },
    ],
    scores: { A: 5, B: 4, C: 3, D: 4 },
  },
  {
    id: "p10", dim: 4,
    text: "Como você enxerga o papel dos relacionamentos profissionais no seu sucesso dos próximos 5 anos?",
    opcoes: [
      { v: "A", l: "É o principal multiplicador — quem você conhece define o que você alcança" },
      { v: "B", l: "É o que define meu legado — quero ser lembrado pelo impacto que gerei" },
      { v: "C", l: "É importante, mas minha competência técnica é o que mais abre portas" },
      { v: "D", l: "É a base — sem confiança e conexão genuína, nada mais funciona a longo prazo" },
    ],
    scores: { A: 5, B: 4, C: 2, D: 5 },
  },

  // ── AUTENTICIDADE (dim 5) ───────────────────────────────────────────────
  {
    id: "p11", dim: 5,
    text: "Se você pudesse mudar uma coisa no seu comportamento relacional amanhã, o que seria?",
    opcoes: [
      { v: "A", l: "Manter contato regular sem precisar de um motivo específico" },
      { v: "B", l: "Ser mais proativo em iniciar conversas com pessoas novas" },
      { v: "C", l: "Ter um sistema que me ajude a não deixar relações importantes adormecerem" },
      { v: "D", l: "Ser mais autêntico e menos preocupado com como sou percebido" },
    ],
    scores: { A: 4, B: 4, C: 5, D: 5 },
  },
  {
    id: "p12", dim: 5,
    text: "O que uma rede extraordinária representa para você, no nível mais profundo?",
    opcoes: [
      { v: "A", l: "Segurança — saber que tenho pessoas que vão estar lá quando eu precisar" },
      { v: "B", l: "Impacto — a capacidade de multiplicar o bem que posso gerar no mundo" },
      { v: "C", l: "Aceleração — chegar mais longe e mais rápido do que conseguiria sozinho" },
      { v: "D", l: "Pertencimento — fazer parte de algo maior, de uma comunidade que evolui" },
    ],
    scores: { A: 4, B: 5, C: 4, D: 5 },
  },
];

export const SEGMENTS = [
  { value: "agronegocio",    label: "Agronegócio" },
  { value: "tecnologia",     label: "Tecnologia" },
  { value: "financas",       label: "Finanças" },
  { value: "saude",          label: "Saúde" },
  { value: "educacao",       label: "Educação" },
  { value: "varejo",         label: "Varejo / Consumo" },
  { value: "industria",      label: "Indústria" },
  { value: "construcao",     label: "Construção Civil" },
  { value: "consultoria",    label: "Consultoria" },
  { value: "juridico",       label: "Jurídico" },
  { value: "marketing",      label: "Marketing / Comunicação" },
  { value: "rh",             label: "Recursos Humanos" },
  { value: "logistica",      label: "Logística / Supply Chain" },
  { value: "energia",        label: "Energia" },
  { value: "outros",         label: "Outros" },
];

export const OBJECTIVES = [
  { value: "novos_clientes",    label: "Conquistar novos clientes",     icon: "🎯" },
  { value: "oportunidades",     label: "Encontrar oportunidades",       icon: "🚀" },
  { value: "parcerias",         label: "Formar parcerias estratégicas", icon: "🤝" },
  { value: "conhecimento",      label: "Aprender com especialistas",    icon: "📚" },
  { value: "visibilidade",      label: "Aumentar minha visibilidade",   icon: "👁" },
  { value: "mentoria",          label: "Encontrar mentores",            icon: "🧭" },
  { value: "talentos",          label: "Atrair talentos",               icon: "💡" },
  { value: "investidores",      label: "Conectar com investidores",     icon: "💰" },
  { value: "recolocacao",       label: "Recolocação profissional",      icon: "🔄" },
  { value: "comunidade",        label: "Construir comunidade",          icon: "🌐" },
];

export const UFS = [
  { value: "AC", label: "Acre" },          { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },         { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },         { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" }, { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },         { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },   { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },       { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },    { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" }, { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" }, { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },       { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },     { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

export const CATS = [
  { value: "mentor",    label: "Mentor",    color: "#C9A84C", icon: "🧭" },
  { value: "aliado",    label: "Aliado",    color: "#5B9BD5", icon: "🤝" },
  { value: "ponte",     label: "Ponte",     color: "#70AD47", icon: "🔗" },
  { value: "potencial", label: "Potencial", color: "#ED7D31", icon: "🌱" },
  { value: "dormindo",  label: "Dormindo",  color: "#95A5A6", icon: "💤" },
];

export const ITYPES = [
  { value: "mensagem",  label: "Mensagem",  icon: "💬" },
  { value: "ligacao",   label: "Ligação",   icon: "📞" },
  { value: "reuniao",   label: "Reunião",   icon: "🤝" },
  { value: "evento",    label: "Evento",    icon: "🎪" },
  { value: "email",     label: "E-mail",    icon: "📧" },
  { value: "indicacao", label: "Indicação", icon: "🔗" },
  { value: "conteudo",  label: "Conteúdo",  icon: "📄" },
  { value: "outro",     label: "Outro",     icon: "📌" },
];

export const SENTS = [
  { value: "muito_positivo", label: "Muito positivo", color: "#27AE60", icon: "😊" },
  { value: "positivo",       label: "Positivo",       color: "#2ECC71", icon: "🙂" },
  { value: "neutro",         label: "Neutro",         color: "#95A5A6", icon: "😐" },
  { value: "negativo",       label: "Negativo",       color: "#E74C3C", icon: "😕" },
];
