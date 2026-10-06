import { computePriorities } from './priorityEngine.js';
import { buildFeedbackMap } from './alertsFeedback.js';
import { detectPatterns } from './relationshipPatternDetector.js';
import { computeObservedDimensions } from './dimensionObservation.js';
import { localDay } from './relationshipTriggers.js';

// Uma decisão, com a mesma evidência, para Danna, Home, Teia e cron.
export function computeRelationshipIntelligence(data = {}, now = new Date()) {
  const {
    contacts = [],
    interactions = [],
    alerts = [],
    memories = [],
    events = [],
    profile = {},
  } = data;

  const timezone = profile?.timezone || 'America/Sao_Paulo';

  const priorities = computePriorities(
    contacts,
    buildFeedbackMap(alerts),
    now,
    interactions,
    { memories, events, timezone }
  );

  const decisions = [priorities.main, ...priorities.secondary].filter(Boolean);

  return {
    ...priorities,
    decisions,
    generatedAt: now.toISOString(),
    today: localDay(now, timezone),
    timezone,
    patterns: detectPatterns(contacts, interactions, now),
    dimensions: computeObservedDimensions(contacts, interactions, now),
    coverage: {
      contacts: contacts.length,
      interactions: interactions.length,
      memories: memories.length,
      events: events.length,
    },
    status: decisions.length ? 'actionable' : 'no_supported_action',
  };
}
