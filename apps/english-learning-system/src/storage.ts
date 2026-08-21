import type { ActivityEvent, ActivityType, AppUser, LegacyStateSnapshot, VocabularyCard } from './domain'

const EVENT_KEY = 'els.activity-events.v1'
const CARD_KEY = 'els.vocabulary-cards.v1'
const DEVICE_KEY = 'els.device-id.v1'
const SESSION_KEY = 'els.session-id.v1'
const LEGACY_STATE_KEY = 'els.legacy-state.v1'
const PRIVATE_PREFIXES = ['els.', 'sb-']

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`
}

export function stableId(key: string, prefix: string) {
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const created = makeId(prefix)
  localStorage.setItem(key, created)
  return created
}

export function activityLog(user: AppUser | null, type: ActivityType, payload: Record<string, unknown> = {}, contentId?: string) {
  if (!user) return
  const events = readJson<ActivityEvent[]>(EVENT_KEY, [])
  const event: ActivityEvent = {
    id: makeId('evt'), userId: user.id, sessionId: stableId(SESSION_KEY, 'ses'),
    type, contentId, occurredAt: new Date().toISOString(), deviceId: stableId(DEVICE_KEY, 'dev'),
    payload, synced: false,
  }
  localStorage.setItem(EVENT_KEY, JSON.stringify([event, ...events].slice(0, 5000)))
  window.dispatchEvent(new CustomEvent('els:data-change'))
}

export function getEvents() {
  return readJson<ActivityEvent[]>(EVENT_KEY, [])
}

export function getCards() {
  return readJson<VocabularyCard[]>(CARD_KEY, [])
}

export function mergeCards(user: AppUser, incoming: VocabularyCard[]) {
  const others = getCards().filter(card => card.userId !== user.id)
  const merged = new Map<string, VocabularyCard>()
  for (const card of [...getCards().filter(card => card.userId === user.id), ...incoming]) {
    const key = card.word.trim().toLowerCase()
    const previous = merged.get(key)
    if (!previous || new Date(card.updatedAt) >= new Date(previous.updatedAt)) merged.set(key, card)
  }
  localStorage.setItem(CARD_KEY, JSON.stringify([...merged.values(), ...others]))
  window.dispatchEvent(new CustomEvent('els:data-change'))
}

export function saveCard(user: AppUser, word: string, translation: string, sourceContentId?: string) {
  const cards = getCards()
  const existing = cards.find(card => card.userId === user.id && card.word.toLowerCase() === word.toLowerCase())
  if (existing) {
    existing.translation = translation
    existing.updatedAt = new Date().toISOString()
  } else {
    cards.unshift({
      id: makeId('card'), userId: user.id, word, translation, sourceContentId,
      mastery: 0, nextReviewAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
  }
  localStorage.setItem(CARD_KEY, JSON.stringify(cards))
  activityLog(user, 'word_saved', { word, translation }, sourceContentId)
}

export function markEventsSynced(ids: string[]) {
  const syncedIds = new Set(ids)
  const events = getEvents().map(event => syncedIds.has(event.id) ? { ...event, synced: true } : event)
  localStorage.setItem(EVENT_KEY, JSON.stringify(events))
  window.dispatchEvent(new CustomEvent('els:data-change'))
}

function legacyValues() {
  const values: Record<string, string> = {}
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || PRIVATE_PREFIXES.some(prefix => key.startsWith(prefix))) continue
    const value = localStorage.getItem(key)
    if (value !== null) values[key] = value
  }
  return values
}

export function getLegacySnapshot(user: AppUser) {
  return readJson<Record<string, LegacyStateSnapshot>>(LEGACY_STATE_KEY, {})[user.id] || null
}

export function captureLegacyState(user: AppUser) {
  const snapshots = readJson<Record<string, LegacyStateSnapshot>>(LEGACY_STATE_KEY, {})
  const values = legacyValues()
  const previous = snapshots[user.id]
  if (previous && JSON.stringify(previous.values) === JSON.stringify(values)) return previous
  const snapshot: LegacyStateSnapshot = { userId: user.id, values, updatedAt: new Date().toISOString() }
  snapshots[user.id] = snapshot
  localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify(snapshots))
  window.dispatchEvent(new CustomEvent('els:data-change'))
  return snapshot
}

export function applyLegacyState(user: AppUser, incoming: LegacyStateSnapshot) {
  const current = getLegacySnapshot(user)
  if (current && new Date(current.updatedAt) > new Date(incoming.updatedAt)) return current
  for (const [key, value] of Object.entries(incoming.values)) {
    if (!PRIVATE_PREFIXES.some(prefix => key.startsWith(prefix))) localStorage.setItem(key, value)
  }
  const snapshots = readJson<Record<string, LegacyStateSnapshot>>(LEGACY_STATE_KEY, {})
  snapshots[user.id] = { ...incoming, userId: user.id }
  localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify(snapshots))
  window.dispatchEvent(new CustomEvent('els:data-change'))
  return incoming
}
