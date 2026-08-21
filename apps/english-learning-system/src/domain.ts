export type Role = 'teacher' | 'student'
export type ContentKind = 'exam' | 'dictation' | 'knowledge'
export type ActivityType =
  | 'login'
  | 'logout'
  | 'content_open'
  | 'answer_change'
  | 'submission'
  | 'analysis_open'
  | 'translation_open'
  | 'word_saved'
  | 'word_reviewed'
  | 'audio_played'
  | 'print'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'

export interface AppUser {
  id: string
  role: Role
  displayName: string
  studentCode?: string
}

export interface ContentItem {
  id: string
  title: string
  kind: ContentKind
  subtype: string
  units: string
  sourceFile: string
  description: string
  published: boolean
  updatedAt: string
}

export interface ActivityEvent {
  id: string
  userId: string
  sessionId: string
  type: ActivityType
  contentId?: string
  occurredAt: string
  deviceId: string
  payload: Record<string, unknown>
  synced: boolean
}

export interface VocabularyCard {
  id: string
  userId: string
  word: string
  translation: string
  sourceContentId?: string
  mastery: 0 | 1 | 2 | 3 | 4 | 5
  nextReviewAt: string
  updatedAt: string
}

export interface LegacyStateSnapshot {
  userId: string
  values: Record<string, string>
  updatedAt: string
}
