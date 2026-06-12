// CONÉXIA — Dados e constantes do sistema

export const DIMS = [
  { key: "intencao_estrategica",  label: "Intenção Estratégica",  short: "IE", color: "#C9A84C" },
  { key: "escuta_relacional",     label: "Escuta Relacional",     short: "ER", color: "#5B9BD5" },
  { key: "presenca_mercado",      label: "Presença de Mercado",   short: "PM", color: "#70AD47" },
  { key: "reciprocidade_ativa",   label: "Reciprocidade Ativa",   short: "RA", color: "#ED7D31" },
  { key: "ritual_consistencia",   label: "Ritual & Consistência", short: "RC", color: "#9B59B6" },
  { key: "confianca_autentica",   label: "Confiança Autêntica",   short: "CA", color: "#E74C3C" },
];

export const QS = [
  // Intenção Estratégica (dim 0)
  { id: "ie1", dim: 0, text: "Tenho clareza sobre quais pessoas preciso ter na minha rede para atingir meus objetivos profissionais.", rev: false },
  { id: "ie2", dim: 0, text: "Antes de eventos ou encontros, defino com quem quero conversar e o que quero aprender.", rev: false },
  { id: "ie3", dim: 0, text: "Faço networking apenas quando preciso de algo — não de forma proativa.", rev: true },
  { id: "ie4", dim: 0, text: "Consigo articular claramente o valor que ofereço às pessoas da minha rede.", rev: false },
  // Escuta Relacional (dim 1)
  { id: "er1", dim: 1, text: "Durante conversas, foco genuinamente no que a outra pessoa está dizendo, sem pensar no que vou responder.", rev: false },
  { id: "er2", dim: 1, text: "Lembro de detalhes pessoais sobre contatos e os uso para personalizar interações futuras.", rev: false },
  { id: "er3", dim: 1, text: "Frequentemente interrompo ou desvio conversas para falar sobre mim mesmo.", rev: true },
  { id: "er4", dim: 1, text: "Faço perguntas que revelam interesse genuíno na vida e nos desafios das pessoas.", rev: false },
  // Presença de Mercado (dim 2)
  { id: "pm1", dim: 2, text: "Sou reconhecido como referência no meu setor ou área de atuação.", rev: false },
  { id: "pm2", dim: 2, text: "Compartilho conteúdo relevante regularmente nas redes profissionais.", rev: false },
  { id: "pm3", dim: 2, text: "Participo ativamente de eventos, grupos e comunidades do meu setor.", rev: false },
  { id: "pm4", dim: 2, text: "Pessoas me procuram espontaneamente para pedir conselhos ou indicações.", rev: false },
  // Reciprocidade Ativa (dim 3)
  { id: "ra1", dim: 3, text: "Costumo conectar pessoas da minha rede que poderiam se beneficiar mutuamente.", rev: false },
  { id: "ra2", dim: 3, text: "Ofereço ajuda, indicações ou recursos sem esperar nada em troca.", rev: false },
  { id: "ra3", dim: 3, text: "Mantenho um registro mental ou físico de como posso gerar valor para cada contato.", rev: false },
  { id: "ra4", dim: 3, text: "Fico desconfortável em pedir favores ou ajuda, mesmo quando preciso.", rev: true },
  // Ritual & Consistência (dim 4)
  { id: "rc1", dim: 4, text: "Tenho um ritual semanal ou mensal dedicado a nutrir minha rede de contatos.", rev: false },
  { id: "rc2", dim: 4, text: "Faço follow-up consistente após conhecer alguém novo.", rev: false },
  { id: "rc3", dim: 4, text: "Meu networking é reativo — só apareço quando preciso de algo.", rev: true },
  { id: "rc4", dim: 4, text: "Uso ferramentas ou sistemas para lembrar de manter contato com pessoas importantes.", rev: false },
  // Confiança Autêntica (dim 5)
  { id: "ca1", dim: 5, text: "As pessoas da minha rede me descrevem como alguém confiável e de palavra.", rev: false },
  { id: "ca2", dim: 5, text: "Sou transparente sobre minhas limitações e peço ajuda quando necessário.", rev: false },
  { id: "ca3", dim: 5, text: "Adapto minha personalidade dependendo de com quem estou, perdendo autenticidade.", rev: true },
  { id: "ca4", dim: 5, text: "Mantenho relacionamentos de longo prazo baseados em confiança mútua.", rev: false },
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
  { value: "mentor",    label: "Mentor",    color: "#C9A84C" },
  { value: "aliado",    label: "Aliado",    color: "#5B9BD5" },
  { value: "ponte",     label: "Ponte",     color: "#70AD47" },
  { value: "potencial", label: "Potencial", color: "#ED7D31" },
  { value: "dormindo",  label: "Dormindo",  color: "#95A5A6" },
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
  { value: "muito_positivo", label: "Muito positivo", color: "#27AE60" },
  { value: "positivo",       label: "Positivo",       color: "#2ECC71" },
  { value: "neutro",         label: "Neutro",         color: "#95A5A6" },
  { value: "negativo",       label: "Negativo",       color: "#E74C3C" },
];
