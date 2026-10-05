import test from "node:test";
import assert from "node:assert/strict";
import { circlePath, descendantIds, resolveCircle } from "../shared/networkCircles.js";

const circles = [
  { id: "work", name: "Profissional", parent_id: null },
  { id: "coffee", name: "Café", parent_id: "work" },
  { id: "coop", name: "Cooperativas", parent_id: "coffee" },
  { id: "personal", name: "Pessoal", parent_id: null },
  { id: "otherCoffee", name: "Café", parent_id: "personal" },
];

test("Inclui subgrupos sem duplicar contatos", () => {
  assert.deepEqual([...descendantIds(circles, "work")], ["work", "coffee", "coop"]);
  assert.equal(circlePath(circles, "coop"), "Profissional → Café → Cooperativas");
});

test("Desambigua nomes iguais pelo caminho", () => {
  assert.equal(resolveCircle(circles, "cafe"), null);
  assert.equal(resolveCircle(circles, "profissional > cafe").id, "coffee");
  assert.equal(resolveCircle(circles, "Pessoal / Café").id, "otherCoffee");
  assert.equal(resolveCircle(circles, "no Profissional").id, "work");
  assert.equal(resolveCircle(circles, "coloca no círculo Profissional").id, "work");
  assert.equal(resolveCircle(circles, "coloca em Profissional → Café").id, "coffee");
  assert.equal(resolveCircle(circles, "grupo inexistente"), null);
});

test("Protege contra hierarquia circular", () => {
  const malformed = [
    { id: "a", name: "A", parent_id: "b" },
    { id: "b", name: "B", parent_id: "a" },
  ];
  assert.equal(circlePath(malformed, "a"), "B → A");
  assert.equal(descendantIds(malformed, "a").size, 2);
  assert.equal(circlePath(circles, "missing"), "");
});
