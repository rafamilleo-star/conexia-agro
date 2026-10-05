export const UNASSIGNED = "__unassigned__";

export function circlePath(circles, id) {
  const names = [];
  const seen = new Set();
  let circle = circles.find(c => c.id === id);
  while (circle && !seen.has(circle.id)) {
    seen.add(circle.id);
    names.unshift(circle.name);
    circle = circles.find(c => c.id === circle.parent_id);
  }
  return names.join(" → ");
}

export function descendantIds(circles, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const circle of circles) {
      if (ids.has(circle.parent_id) && !ids.has(circle.id)) {
        ids.add(circle.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function resolveCircle(circles, text) {
  const normalize = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/\s*(?:→|>|\/)\s*/g, " > ");
  const query = normalize(text).replace(/^(?:(?:coloque|coloca|colocar|inserir|insere|em|no|na|circulo|grupo)\s+)+/, "");
  const matches = circles.filter(c => normalize(c.name) === query || normalize(circlePath(circles, c.id)) === query);
  return matches.length === 1 ? matches[0] : null;
}
