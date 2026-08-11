/**
 * CONÉXIA — Normalização de texto para comparação de nomes.
 *
 * Extraído de api/_lib/relationshipAssistant/icsImport.js (Fase 2, ago/2026)
 * para shared/ porque agora tem dois consumidores: o matching de calendário
 * (icsImport.js) e o entity matching do Radar (shared/entityMatching.js).
 * shared/ é a direção certa de dependência — api/ importa de shared/, nunca
 * o contrário — para não acoplar um módulo puro de string ao diretório de
 * backend.
 */
export function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default normalize;
