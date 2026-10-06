import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabase.js';
import { loadRelationshipData } from '../../shared/relationshipData.js';
import { computeRelationshipIntelligence } from '../../shared/relationshipIntelligence.js';
const EMPTY = [];

export function invalidateRelationshipIntelligence() {
  window.dispatchEvent(new Event('conexia:relationship-changed'));
}

export default function useRelationshipIntelligence(userId, contacts = EMPTY, interactions = EMPTY, alerts = EMPTY) {
  const [loaded, setLoaded] = useState(null);
  const [clock, setClock] = useState(() => new Date());
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let revision = 0;
    setLoaded(null);

    async function refresh() {
      const turn = ++revision;
      const now = new Date();
      setClock(now);

      if (!userId) return;

      try {
        const data = await loadRelationshipData(supabase, userId, now);

        if (active && turn === revision) {
          setLoaded({ userId, data });
          setError(null);
        }
      } catch (e) {
        if (active && turn === revision) {
          setLoaded(null);
          setError(e.message);
        }
      }
    }

    void refresh();

    const changed = () => void refresh();

    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60000);

    window.addEventListener('conexia:relationship-changed', changed);
    document.addEventListener('visibilitychange', visible);

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('conexia:relationship-changed', changed);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId, contacts, interactions, alerts]);

  return useMemo(() => ({
    ...computeRelationshipIntelligence(
      loaded?.userId === userId
        ? loaded.data
        : userId
          ? {}
          : { contacts, interactions, alerts },
      clock
    ),
    complete: loaded?.userId === userId,
    error,
  }), [loaded, userId, contacts, interactions, alerts, clock, error]);
}
