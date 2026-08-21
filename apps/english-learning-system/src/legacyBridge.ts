export interface StorageReader {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
}

export interface LegacyWordDetails {
  definition?: string
  unit?: string
  family?: unknown[]
  phrases?: unknown[]
  contrasts?: unknown[]
}

export interface ImportedVocabularyCard {
  id: string
  userId: string
  word: string
  translation: string
  partOfSpeech?: string
  definition?: string
  sourceContentId?: string
  sourceTitle?: string
  context?: string
  contexts?: string[]
  scope?: string
  family?: Array<{ word: string, meaning: string, unit?: string }>
  phrases?: Array<{ phrase: string, meaning: string }>
  contrasts?: Array<{ word: string, meaning: string, unit?: string }>
  mastery: 0
  nextReviewAt: string
  updatedAt: string
}

interface CollectOptions {
  userId: string
  contentId: string
  sourceTitle: string
  resolve?: (word: string) => LegacyWordDetails | null
}

interface LegacySavedWord {
  word: string
  context?: string
  contexts?: string[]
  scope?: string
  time?: number | string
  translation?: string
  definition?: string
  d?: string
}

const VOCABULARY_KEY = /(vocab|notebook|saved.?words?)/i

function stableWordId(userId: string, word: string) {
  let hash = 2166136261
  for (const character of `${userId}:${word.toLowerCase()}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `legacy_card_${(hash >>> 0).toString(36)}`
}

function tupleWordRelations(value: unknown): Array<{ word: string, meaning: string, unit?: string }> {
  if (!Array.isArray(value)) return []
  const result: Array<{ word: string, meaning: string, unit?: string }> = []
  for (const item of value) if (Array.isArray(item) && typeof item[0] === 'string') {
    result.push({ word: item[0], meaning: typeof item[1] === 'string' ? item[1] : '', unit: typeof item[2] === 'string' ? item[2] : undefined })
  }
  return result
}

function tuplePhrases(value: unknown): Array<{ phrase: string, meaning: string }> {
  if (!Array.isArray(value)) return []
  const result: Array<{ phrase: string, meaning: string }> = []
  for (const item of value) if (Array.isArray(item) && typeof item[0] === 'string') {
    result.push({ phrase: item[0], meaning: typeof item[1] === 'string' ? item[1] : '' })
  }
  return result
}

function safeDate(value: number | string | undefined) {
  const parsed = value ? new Date(value) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

export function splitDefinition(definition: string) {
  const value = definition.trim()
  const chineseIndex = value.search(/[\u3400-\u9fff]/)
  if (chineseIndex <= 0) return { partOfSpeech: '', translation: value }
  const possiblePart = value.slice(0, chineseIndex).trim()
  if (!/^[a-z./\s-]+$/i.test(possiblePart) || possiblePart.length > 20) {
    return { partOfSpeech: '', translation: value }
  }
  return { partOfSpeech: possiblePart, translation: value.slice(chineseIndex).trim() }
}

function findSavedWords(key: string, value: unknown) {
  const found: LegacySavedWord[] = []
  if (Array.isArray(value) && VOCABULARY_KEY.test(key)) {
    for (const word of value) if (typeof word === 'string') found.push({ word })
    return found
  }
  if (!value || typeof value !== 'object') return found
  const record = value as Record<string, unknown>
  if (Array.isArray(record.saved)) {
    for (const word of record.saved) if (typeof word === 'string') found.push({ word })
  }
  if (!VOCABULARY_KEY.test(key)) return found
  for (const item of Object.values(record)) {
    if (item && typeof item === 'object' && typeof (item as LegacySavedWord).word === 'string') {
      found.push(item as LegacySavedWord)
    }
  }
  return found
}

export function collectLegacyVocabulary(storage: StorageReader, options: CollectOptions) {
  const savedWords = new Map<string, LegacySavedWord>()
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || key.startsWith('els.') || key.startsWith('sb-')) continue
    const raw = storage.getItem(key)
    if (!raw) continue
    try {
      for (const item of findSavedWords(key, JSON.parse(raw))) {
        const normalized = item.word.trim().toLowerCase()
        if (normalized) savedWords.set(normalized, { ...savedWords.get(normalized), ...item, word: item.word.trim() })
      }
    } catch {
      // Legacy pages occasionally keep plain strings under unrelated keys.
    }
  }

  return [...savedWords.values()].map(item => {
    const details = options.resolve?.(item.word) || {}
    const definition = details.definition || item.definition || item.d || item.translation || '中文释义待从原文词卡补全'
    const { partOfSpeech, translation } = splitDefinition(definition)
    const contexts = [...new Set([...(item.contexts || []), item.context].filter((value): value is string => Boolean(value)))]
    const updatedAt = safeDate(item.time)
    return {
      id: stableWordId(options.userId, item.word),
      userId: options.userId,
      word: item.word,
      translation,
      partOfSpeech,
      definition,
      sourceContentId: options.contentId,
      sourceTitle: options.sourceTitle,
      context: item.context || contexts[0],
      contexts,
      scope: details.unit || item.scope,
      family: tupleWordRelations(details.family),
      phrases: tuplePhrases(details.phrases),
      contrasts: tupleWordRelations(details.contrasts),
      mastery: 0 as const,
      nextReviewAt: updatedAt,
      updatedAt,
    }
  })
}

export const LEGACY_PANEL_STABILITY_CSS = `
  body.wp-open .page {
    margin-left: auto !important;
    margin-right: auto !important;
    max-width: var(--els-page-max-width) !important;
  }
`

export function resolveLegacyWordDetails(frameWindow: Window, word: string): LegacyWordDetails | null {
  try {
    const expression = `(() => {
      const raw = ${JSON.stringify(word)};
      const key = typeof findWordKey === 'function' ? findWordKey(raw) : raw.toLowerCase();
      const source = typeof WORDS !== 'undefined' ? WORDS : null;
      const data = source && source[key];
      return data ? { definition: data.d || '', unit: data.u || '', family: data.f || [], phrases: data.p || [], contrasts: data.o || [] } : null;
    })()`
    return (frameWindow as Window & { eval: (source: string) => LegacyWordDetails | null }).eval(expression)
  } catch {
    return null
  }
}

export function stabilizeLegacyWordPanel(frameDocument: Document, frameWindow: Window) {
  const page = frameDocument.querySelector<HTMLElement>('.page')
  if (page) {
    const maxWidth = frameWindow.getComputedStyle(page).maxWidth
    frameDocument.documentElement.style.setProperty('--els-page-max-width', maxWidth === 'none' ? `${page.getBoundingClientRect().width}px` : maxWidth)
  }
  if (!frameDocument.getElementById('els-panel-stability')) {
    const style = frameDocument.createElement('style')
    style.id = 'els-panel-stability'
    style.textContent = LEGACY_PANEL_STABILITY_CSS
    frameDocument.head.append(style)
  }
}
