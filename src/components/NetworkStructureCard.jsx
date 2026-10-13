import { useMemo } from 'react';
import { C } from '../utils/theme.js';
import { analyzeNetworkStructure } from '../../shared/networkStructure.js';

export default function NetworkStructureCard({ contacts = [], onSelectContact }) {
  const structure = useMemo(() => analyzeNetworkStructure(contacts), [contacts]);
  if (!structure.total) return null;
  return (
    <details style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 16, marginBottom: 16, fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>
      <summary style={{ cursor: 'pointer', color: C.gold, fontWeight: 600 }}>Estrutura da rede cadastrada</summary>
      <p style={{ color: C.txM, lineHeight: 1.6 }}>{structure.knownCompany} de {structure.total} contatos têm empresa informada, distribuídos em {structure.companyCount} empresas. Esta leitura considera apenas o que você cadastrou.</p>
      {structure.unknownCompany > 0 && <p style={{ color: C.txM }}>{structure.unknownCompany} contatos sem empresa informada. Completar esses dados melhora a leitura.</p>}
      {structure.concentration && <p style={{ lineHeight: 1.6 }}>Mais da metade dos contatos com empresa informada está em <strong>{structure.concentration.company}</strong> ({structure.concentration.contacts.length} de {structure.knownCompany}). Essa concentração faz sentido para seus objetivos?</p>}
      {structure.singleContactCompanies.length > 0 && (
        <div>
          <p style={{ color: C.txM }}>Em {structure.singleContactCompanies.length} empresas há apenas um contato cadastrado. Se alguma for importante para você, vale avaliar outras conexões.</p>
          {structure.singleContactCompanies.slice(0, 3).map(group => (
            <button type="button" key={group.company} onClick={() => onSelectContact?.(group.contacts[0].id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: C.sf, color: C.txt, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
              {group.company} · {group.contacts[0].name} →
            </button>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: C.txL, lineHeight: 1.5 }}>Empresa em comum não comprova que duas pessoas se conhecem. Os registros não permitem afirmar dependência, influência ou caminhos entre elas.</p>
    </details>
  );
}
