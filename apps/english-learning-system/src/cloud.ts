import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ActivityEvent, AppUser, LegacyStateSnapshot, Role, VocabularyCard } from './domain'
import { applyLegacyState, getCards, getLegacySnapshot, mergeCards } from './storage'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloud: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
}) : null

export const isCloudConfigured = Boolean(cloud)

function studentEmail(studentCode: string) {
  const normalized = studentCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return `${normalized}@students.english-learning.app`
}

export async function signIn(role: Role, account: string, password: string): Promise<AppUser> {
  if (!cloud) throw new Error('云端尚未配置')
  const email = role === 'teacher' ? account.trim().toLowerCase() : studentEmail(account)
  const { data, error } = await cloud.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.user) throw new Error('登录成功但没有返回用户信息')

  const { data: profile, error: profileError } = await cloud
    .from('profiles')
    .select('id, role, display_name, student_code')
    .eq('id', data.user.id)
    .single()
  if (profileError) {
    await cloud.auth.signOut()
    throw new Error('账号尚未完成角色配置，请联系教师')
  }
  if (profile.role !== role) {
    await cloud.auth.signOut()
    throw new Error('当前账号与所选身份不一致')
  }
  return {
    id: profile.id,
    role: profile.role,
    displayName: profile.display_name,
    studentCode: profile.student_code || undefined,
  }
}

export async function signOutCloud() {
  if (cloud) await cloud.auth.signOut()
}

export async function updateOwnPassword(password: string) {
  if (!cloud) throw new Error('云端尚未配置')
  const { error } = await cloud.auth.updateUser({ password })
  if (error) throw error
}

export async function pushEvents(events: ActivityEvent[]) {
  if (!cloud) return { ok: false as const, reason: 'not_configured' as const }
  const { data, error: userError } = await cloud.auth.getUser()
  if (userError || !data.user) throw new Error('云端登录已失效，请重新登录')
  const pending = events.filter(event => !event.synced && event.userId === data.user.id)
  if (!pending.length) return { ok: true as const, count: 0, ids: [] as string[] }
  const rows = pending.map(event => ({
    id: event.id,
    user_id: event.userId,
    session_id: event.sessionId,
    event_type: event.type,
    content_id: null,
    occurred_at: event.occurredAt,
    device_id: event.deviceId,
    payload: { ...event.payload, legacyContentId: event.contentId || null },
  }))
  const { error } = await cloud.from('activity_events').upsert(rows, { onConflict: 'id' })
  if (error) throw error
  return { ok: true as const, count: rows.length, ids: pending.map(event => event.id) }
}

function cardFromRow(row: Record<string, unknown>, user: AppUser): VocabularyCard {
  const details = row.details && typeof row.details === 'object' ? row.details as Partial<VocabularyCard> : {}
  return {
    ...details,
    id: String(row.id),
    userId: user.id,
    word: String(row.word),
    translation: String(row.translation || ''),
    sourceContentId: row.legacy_source_id ? String(row.legacy_source_id) : undefined,
    mastery: Number(row.mastery || 0) as VocabularyCard['mastery'],
    nextReviewAt: String(row.next_review_at),
    updatedAt: String(row.updated_at),
  }
}

async function syncCards(user: AppUser) {
  if (!cloud || user.role !== 'student') return 0
  let detailsSupported = true
  const richResult = await cloud
    .from('vocabulary_cards')
    .select('id, word, translation, legacy_source_id, mastery, next_review_at, updated_at, details')
    .eq('student_id', user.id)
    .is('deleted_at', null)
  let remoteRows = richResult.data as Record<string, unknown>[] | null
  let readError = richResult.error
  if (readError && /details/i.test(readError.message)) {
    detailsSupported = false
    const fallback = await cloud
      .from('vocabulary_cards')
      .select('id, word, translation, legacy_source_id, mastery, next_review_at, updated_at')
      .eq('student_id', user.id)
      .is('deleted_at', null)
    remoteRows = fallback.data as Record<string, unknown>[] | null
    readError = fallback.error
  }
  if (readError) throw readError
  mergeCards(user, (remoteRows || []).map(row => cardFromRow(row, user)))
  const latest = getCards().filter(card => card.userId === user.id)
  if (!latest.length) return 0
  const rows = latest.map(card => ({
    student_id: user.id,
    word: card.word,
    translation: card.translation,
    source_content_id: null,
    legacy_source_id: card.sourceContentId || null,
    details: {
      partOfSpeech: card.partOfSpeech,
      definition: card.definition,
      sourceTitle: card.sourceTitle,
      context: card.context,
      contexts: card.contexts,
      scope: card.scope,
      family: card.family,
      phrases: card.phrases,
      contrasts: card.contrasts,
    },
    mastery: card.mastery,
    next_review_at: card.nextReviewAt,
    updated_at: card.updatedAt,
    deleted_at: null,
  }))
  const payload = detailsSupported ? rows : rows.map(({ details: _details, ...row }) => row)
  const { error } = await cloud.from('vocabulary_cards').upsert(payload, { onConflict: 'student_id,word' })
  if (error) throw error
  return rows.length
}

async function syncLegacyState(user: AppUser) {
  if (!cloud || user.role !== 'student') return false
  const stateKey = 'legacy-html-localstorage-v1'
  const { data: remote, error } = await cloud
    .from('user_app_states')
    .select('state, updated_at')
    .eq('student_id', user.id)
    .eq('state_key', stateKey)
    .maybeSingle()
  if (error) throw error
  const local = getLegacySnapshot(user)
  const remoteSnapshot: LegacyStateSnapshot | null = remote ? {
    userId: user.id,
    values: (remote.state || {}) as Record<string, string>,
    updatedAt: remote.updated_at,
  } : null
  if (remoteSnapshot && (!local || new Date(remoteSnapshot.updatedAt) > new Date(local.updatedAt))) {
    applyLegacyState(user, remoteSnapshot)
    return true
  }
  if (local) {
    const { error: writeError } = await cloud.from('user_app_states').upsert({
      student_id: user.id,
      state_key: stateKey,
      state: local.values,
      updated_at: local.updatedAt,
    }, { onConflict: 'student_id,state_key' })
    if (writeError) throw writeError
    return true
  }
  return false
}

export async function syncAll(user: AppUser, events: ActivityEvent[]) {
  if (!cloud) return { ok: false as const, reason: 'not_configured' as const }
  const eventResult = await pushEvents(events)
  const cards = await syncCards(user)
  const state = await syncLegacyState(user)
  return {
    ok: true as const,
    count: eventResult.ok ? eventResult.count : 0,
    ids: eventResult.ok ? eventResult.ids : [],
    cards,
    state,
  }
}

export async function createStudent(studentCode: string, pin: string, displayName: string) {
  if (!cloud) throw new Error('云端尚未配置')
  const { data, error } = await cloud.functions.invoke('create-student', {
    body: { studentCode, pin, displayName },
  })
  if (error) {
    let detail = ''
    try {
      const context = (error as { context?: Response }).context
      if (context) detail = String((await context.clone().json())?.error || '')
    } catch { /* 保留 Supabase 返回的基础错误 */ }
    throw new Error(detail || error.message || '创建学生失败')
  }
  if (!data?.student) throw new Error(data?.error || '创建学生失败')
  return data.student as { id: string, studentCode: string, displayName: string }
}

export interface TeacherActivityRow {
  id: string
  studentId: string
  studentName: string
  studentCode: string
  eventType: string
  occurredAt: string
  contentId?: string
  payload: Record<string, unknown>
}

export async function fetchTeacherActivity(): Promise<TeacherActivityRow[]> {
  if (!cloud) return []
  const { data: links, error: linkError } = await cloud.from('teacher_student_links').select('student_id')
  if (linkError) throw linkError
  const ids = (links || []).map(link => link.student_id)
  if (!ids.length) return []
  const [{ data: profiles, error: profileError }, { data: events, error: eventError }] = await Promise.all([
    cloud.from('profiles').select('id, display_name, student_code').in('id', ids),
    cloud.from('activity_events').select('id, user_id, event_type, content_id, occurred_at, payload').in('user_id', ids).order('occurred_at', { ascending: false }).limit(300),
  ])
  if (profileError) throw profileError
  if (eventError) throw eventError
  const names = new Map((profiles || []).map(profile => [profile.id, profile]))
  return (events || []).map(event => {
    const profile = names.get(event.user_id)
    return {
      id: event.id,
      studentId: event.user_id,
      studentName: profile?.display_name || '学生',
      studentCode: profile?.student_code || '',
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      contentId: event.content_id || undefined,
      payload: (event.payload || {}) as Record<string, unknown>,
    }
  })
}
