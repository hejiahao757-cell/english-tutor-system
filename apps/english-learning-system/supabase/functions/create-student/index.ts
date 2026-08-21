import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: '仅支持 POST 请求' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization) return json({ error: '认证配置不完整' }, 401)

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: authData, error: authError } = await callerClient.auth.getUser()
  if (authError || !authData.user) return json({ error: '教师登录已失效' }, 401)

  const { data: teacher } = await admin
    .from('profiles')
    .select('id, role, archived_at')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (!teacher || teacher.role !== 'teacher' || teacher.archived_at) return json({ error: '仅教师可以创建学生账号' }, 403)

  let body: { studentCode?: string, pin?: string, displayName?: string }
  try { body = await request.json() } catch { return json({ error: '请求内容不是有效 JSON' }, 400) }
  const studentCode = String(body.studentCode || '').trim().toUpperCase()
  const pin = String(body.pin || '')
  const displayName = String(body.displayName || '').trim()
  if (!/^[A-Z][A-Z0-9_-]{2,19}$/.test(studentCode)) return json({ error: '学生编号格式不正确' }, 400)
  if (!/^\d{6}$/.test(pin)) return json({ error: 'PIN 必须是 6 位数字' }, 400)
  if (!displayName || displayName.length > 80) return json({ error: '学生姓名不能为空且不能超过 80 个字符' }, 400)

  const { data: existing } = await admin.from('profiles').select('id').eq('student_code', studentCode).maybeSingle()
  if (existing) return json({ error: `学生编号 ${studentCode} 已存在` }, 409)

  const email = `${studentCode.toLowerCase()}@students.english-learning.app`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { student_code: studentCode, display_name: displayName },
  })
  if (createError || !created.user) return json({ error: createError?.message || '学生账号创建失败' }, 400)

  const { error: linkError } = await admin.from('teacher_student_links').insert({
    teacher_id: teacher.id,
    student_id: created.user.id,
  })
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: '学生账号归属建立失败，已自动回滚' }, 500)
  }

  return json({ student: { id: created.user.id, studentCode, displayName } }, 201)
})
