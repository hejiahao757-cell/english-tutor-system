import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LEGACY_PANEL_STABILITY_CSS,
  collectLegacyVocabulary,
  splitDefinition,
} from '../src/legacyBridge.ts'

function storageOf(values) {
  const entries = Object.entries(values)
  return {
    get length() { return entries.length },
    key(index) { return entries[index]?.[0] ?? null },
    getItem(key) { return values[key] ?? null },
  }
}

test('imports words saved by a legacy lesson into the main vocabulary collection', () => {
  const storage = storageOf({
    english_tutor_set04_vocab_v1: JSON.stringify({
      stable: { word: 'stable', context: 'The system is becoming stable.', contexts: ['The system is becoming stable.'], scope: 'U7', time: 12 },
    }),
    unrelated_answers: JSON.stringify({ q1: 'A' }),
  })

  const cards = collectLegacyVocabulary(storage, {
    userId: 'student:S1001',
    contentId: 'u1-u7',
    sourceTitle: 'U1—U7 综合训练',
    resolve: word => word === 'stable' ? {
      definition: 'adj. 稳定的；牢固的',
      unit: 'U7',
      family: [['stability', 'n. 稳定性', 'U7']],
      phrases: [['remain stable', '保持稳定']],
      contrasts: [['unstable', 'adj. 不稳定的', 'U7']],
    } : null,
  })

  assert.equal(cards.length, 1)
  assert.equal(cards[0].word, 'stable')
  assert.equal(cards[0].partOfSpeech, 'adj.')
  assert.equal(cards[0].translation, '稳定的；牢固的')
  assert.equal(cards[0].context, 'The system is becoming stable.')
  assert.deepEqual(cards[0].phrases, [{ phrase: 'remain stable', meaning: '保持稳定' }])
})

test('understands older saved-word arrays without treating answer objects as vocabulary', () => {
  const storage = storageOf({
    cloze_saved_words: JSON.stringify(['observe', 'evidence']),
    exam_state: JSON.stringify({ saved: ['repair'], answers: { 1: 'B' } }),
    random_state: JSON.stringify({ q1: 'A', q2: 'C' }),
  })

  const cards = collectLegacyVocabulary(storage, {
    userId: 'student:S1001',
    contentId: 'legacy',
    sourceTitle: '历史题目',
    resolve: word => ({ definition: `v. ${word} 的中文释义`, unit: 'U1' }),
  })

  assert.deepEqual(cards.map(card => card.word).sort(), ['evidence', 'observe', 'repair'])
})

test('definition is split into part of speech and Chinese meaning for compact rows', () => {
  assert.deepEqual(splitDefinition('n./v. 记录；记载'), { partOfSpeech: 'n./v.', translation: '记录；记载' })
  assert.deepEqual(splitDefinition('稳定的；牢固的'), { partOfSpeech: '', translation: '稳定的；牢固的' })
})

test('word panel stability rule keeps the lesson page width and position unchanged', () => {
  assert.match(LEGACY_PANEL_STABILITY_CSS, /margin-left:\s*auto\s*!important/)
  assert.match(LEGACY_PANEL_STABILITY_CSS, /margin-right:\s*auto\s*!important/)
  assert.match(LEGACY_PANEL_STABILITY_CSS, /max-width:\s*var\(--els-page-max-width\)\s*!important/)
})

