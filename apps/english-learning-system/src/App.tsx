import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppUser, ContentItem, ContentKind } from './domain'
import { contentSeed, practiceWords } from './seed'
import { activityLog, captureLegacyState, getCards, getEvents, markEventsSynced, saveCard } from './storage'
import { cloud, createStudent, fetchTeacherActivity, isCloudConfigured, signIn, signOutCloud, syncAll, updateOwnPassword, type TeacherActivityRow } from './cloud'

type View = 'home' | 'library' | 'reader' | 'dictation' | 'words' | 'records' | 'settings'

const icon = (name: string) => ({ home: '⌂', library: '▤', dictation: '✎', words: 'Aa', records: '↗', settings: '⚙' }[name] || '•')

function Login({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [account, setAccount] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!account.trim() || !secret.trim()) return setError('请把账号信息填写完整')
    if (role === 'student' && !/^\d{6}$/.test(secret)) return setError('学生 PIN 为 6 位数字')
    setError('')
    setLoading(true)
    try {
      const user: AppUser = isCloudConfigured
        ? await signIn(role, account, secret)
        : role === 'teacher'
          ? { id: `teacher:${account.toLowerCase()}`, role, displayName: '老师' }
          : { id: `student:${account.toUpperCase()}`, role, displayName: account.toUpperCase(), studentCode: account.toUpperCase() }
      localStorage.setItem('els.current-user.v1', JSON.stringify(user))
      activityLog(user, 'login', { loginMethod: role === 'teacher' ? 'email' : 'student_code', cloud: isCloudConfigured })
      if (isCloudConfigured) {
        try {
          const result = await syncAll(user, getEvents())
          if (result.ok) markEventsSynced(result.ids)
        } catch (syncError) {
          console.warn('首次同步暂未完成，数据仍保存在本机。', syncError)
        }
      }
      onLogin(user)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败，请检查账号信息')
    } finally {
      setLoading(false)
    }
  }

  return <main className="login-shell">
    <section className="login-story">
      <div className="brand-mark"><span>EN</span><i /></div>
      <p className="eyebrow">LESSON, MEMORY, GROWTH</p>
      <h1>英语学习系统</h1>
      <p className="lead">把课堂里的每一道题、每一个生词和每一次思考，稳稳带到下一台设备。</p>
      <div className="story-grid">
        <div><b>题库</b><small>高考题型 · 原卷作答</small></div>
        <div><b>知识库</b><small>方法体系 · 随时复习</small></div>
        <div><b>学习痕迹</b><small>离线记录 · 联网同步</small></div>
      </div>
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <span className="edition">内部测试版 0.1</span>
        <h2>继续今天的学习</h2>
        <p>{isCloudConfigured ? '选择身份后登录，系统会先恢复你的云端学习数据。' : '选择身份后登录。当前为本机验证模式。'}</p>
        <div className="role-switch">
          <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}>学生</button>
          <button type="button" className={role === 'teacher' ? 'active' : ''} onClick={() => setRole('teacher')}>教师</button>
        </div>
        <label>{role === 'student' ? '学生编号' : '教师邮箱'}
          <input value={account} onChange={e => setAccount(e.target.value)} placeholder={role === 'student' ? '例如：S1001' : 'name@example.com'} />
        </label>
        <label>{role === 'student' ? '6 位 PIN' : '登录密码'}
          <input value={secret} onChange={e => setSecret(e.target.value)} type="password" inputMode={role === 'student' ? 'numeric' : 'text'} placeholder={role === 'student' ? '••••••' : '请输入密码'} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary" type="submit" disabled={loading}>{loading ? '正在验证…' : '进入系统'} <span>→</span></button>
        {!isCloudConfigured && <button className="demo-link" type="button" onClick={() => { setAccount('S1001'); setSecret('123456'); setRole('student') }}>填入学生演示账号</button>}
      </form>
    </section>
  </main>
}

function Sidebar({ view, setView, user, onLogout }: { view: View, setView: (v: View) => void, user: AppUser, onLogout: () => void }) {
  const items: [View, string][] = [['home','今日'], ['library','内容库'], ['dictation','默听写'], ['words','生词本'], ['records','学习记录'], ['settings','设置']]
  return <aside className="sidebar">
    <div className="mini-brand"><span>EN</span><b>英语学习系统</b></div>
    <nav>{items.map(([key, label]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><i>{icon(key)}</i><span>{label}</span></button>)}</nav>
    <div className="user-chip"><span>{user.displayName.slice(0, 2)}</span><div><b>{user.displayName}</b><small>{user.role === 'teacher' ? '教师端' : `学生 · ${user.studentCode}`}</small></div><button onClick={onLogout} title="退出">↪</button></div>
  </aside>
}

function Topbar({ title }: { title: string }) {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    addEventListener('online', update); addEventListener('offline', update)
    return () => { removeEventListener('online', update); removeEventListener('offline', update) }
  }, [])
  return <header className="topbar"><div><p>英语衔接课 · U1—U7</p><h1>{title}</h1></div><div className={`network ${online ? 'online' : ''}`}><i />{online ? '网络正常' : '离线记录中'}</div></header>
}

function Home({ user, go }: { user: AppUser, go: (v: View) => void }) {
  const eventCount = getEvents().filter(e => e.userId === user.id).length
  const cardCount = getCards().filter(c => c.userId === user.id).length
  return <>
    <section className="hero-card">
      <div><p className="eyebrow">AUGUST · LEARNING PATH</p><h2>{user.role === 'teacher' ? '今天，从一堂清楚的课开始。' : '欢迎回来，继续昨天的进度。'}</h2><p>{user.role === 'teacher' ? '九份原有 HTML 已进入统一内容清单。发布、分配与班级数据将在云端接通后启用。' : '答案、生词与阅读痕迹会先保存在本机，网络恢复后自动同步。'}</p><button className="primary compact" onClick={() => go('library')}>打开内容库 <span>→</span></button></div>
      <div className="hero-visual"><div className="page p1"/><div className="page p2"/><div className="page p3"><b>35</b><span>_______</span><small>find the clue</small></div></div>
    </section>
    <section className="metric-grid">
      <article><span>已收录内容</span><b>9</b><small>考题 · 默听写 · 知识库</small></article>
      <article><span>我的生词</span><b>{cardCount}</b><small>按掌握程度滚动复习</small></article>
      <article><span>已记录操作</span><b>{eventCount}</b><small>本机保留完整学习轨迹</small></article>
    </section>
    <section className="section-head"><div><span>继续学习</span><h2>最近的备课内容</h2></div><button onClick={() => go('library')}>查看全部 →</button></section>
    <div className="recent-grid">{contentSeed.slice(0,3).map((item, index) => <article className="recent-card" key={item.id}><div className={`cover cover-${index+1}`}><span>{item.units}</span><b>{index === 0 ? '7·5' : index === 1 ? '方法' : '词'}</b></div><div><small>{item.subtype}</small><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div>
  </>
}

function Library({ user, onOpen }: { user: AppUser, onOpen: (item: ContentItem) => void }) {
  const [filter, setFilter] = useState<'all' | ContentKind>('all')
  const items = contentSeed.filter(item => filter === 'all' || item.kind === filter)
  function open(item: typeof contentSeed[number]) {
    activityLog(user, 'content_open', { title: item.title, kind: item.kind }, item.id)
    onOpen(item)
  }
  return <>
    <section className="library-tools"><div className="filter-row">{([['all','全部'],['exam','考题'],['dictation','默听写'],['knowledge','知识库']] as const).map(([key,label]) => <button className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} key={key}>{label}</button>)}</div>{user.role === 'teacher' && <button className="outline-button">＋ 导入 HTML</button>}</section>
    <section className="content-list">{items.map((item, index) => <article key={item.id}>
      <button className="content-index" onClick={() => open(item)}>{String(index + 1).padStart(2,'0')}</button>
      <div className="content-main"><div className="tagline"><span className={`kind ${item.kind}`}>{item.kind === 'exam' ? '考题' : item.kind === 'dictation' ? '默听写' : '知识库'}</span><span>{item.subtype}</span><span>{item.units}</span></div><h3>{item.title}</h3><p>{item.description}</p></div>
      <div className="content-actions"><small>更新于 {item.updatedAt}</small><button onClick={() => open(item)}>打开 <span>↗</span></button></div>
    </article>)}</section>
  </>
}

function ContentReader({ user, item, onBack }: { user: AppUser, item: ContentItem, onBack: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [savedAt, setSavedAt] = useState('')
  const target = `./legacy-content/${encodeURIComponent(item.sourceFile)}`
  function saveProgress(log = false) {
    captureLegacyState(user)
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    if (log) activityLog(user, 'answer_change', { source: 'legacy_html', title: item.title }, item.id)
  }
  useEffect(() => {
    const timer = window.setInterval(() => saveProgress(false), 5000)
    return () => { window.clearInterval(timer); captureLegacyState(user) }
  }, [item.id, user.id])
  return <section className="reader-shell">
    <div className="reader-bar"><button className="outline-button" onClick={() => { saveProgress(true); onBack() }}>← 返回内容库</button><div><b>{item.title}</b><small>{savedAt ? `本机已保存 ${savedAt}` : '答题状态会自动保存'}</small></div><button className="primary compact" onClick={() => saveProgress(true)}>保存进度 <span>✓</span></button></div>
    <iframe ref={frame} src={target} title={item.title} onLoad={() => saveProgress(false)} />
  </section>
}

function Dictation({ user }: { user: AppUser }) {
  const [mode, setMode] = useState<'ce'|'ec'|'audio'|'random'>('ce')
  const [cursor, setCursor] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const word = practiceWords[cursor % practiceWords.length]
  function next() { setCursor(i => i + 1); setRevealed(false); activityLog(user, 'answer_change', { module: 'dictation', mode, item: cursor + 1 }) }
  function speak() { speechSynthesis.speak(new SpeechSynthesisUtterance(word[0])); activityLog(user, 'audio_played', { word: word[0] }) }
  const question = mode === 'ce' ? word[1] : mode === 'audio' ? '点击播放，写出你听到的单词' : word[0]
  const answer = mode === 'ce' || mode === 'audio' ? word[0] : word[1]
  return <section className="practice-shell">
    <div className="practice-mode">{([['ce','中 → 英'],['ec','英 → 中'],['audio','听音拼写'],['random','随机抽词']] as const).map(([k,l]) => <button className={mode === k ? 'active' : ''} onClick={() => { setMode(k); setRevealed(false) }} key={k}>{l}</button>)}</div>
    <article className="word-stage"><p>第 {cursor + 1} 词 · U1—U7 词库</p><h2>{mode === 'random' ? (cursor % 2 ? word[0] : word[1]) : question}</h2>{mode === 'audio' && <button className="speaker" onClick={speak}>◖))) 播放发音</button>}<div className="answer-line">{revealed ? answer : ''}</div><div className="stage-actions"><button className="outline-button" onClick={() => setRevealed(v => !v)}>{revealed ? '隐藏答案' : '查看答案'}</button><button className="primary compact" onClick={next}>下一个 <span>→</span></button></div></article>
  </section>
}

function Words({ user }: { user: AppUser }) {
  const [version, setVersion] = useState(0)
  const cards = useMemo(() => getCards().filter(c => c.userId === user.id), [user.id, version])
  return <><section className="word-add"><div><h2>生词本</h2><p>随题保存，按掌握度复习；云端连接后在手机和电脑间同步。</p></div><button className="outline-button" onClick={() => { const sample = practiceWords[(cards.length + 3) % practiceWords.length]; saveCard(user, sample[0], sample[1]); setVersion(v => v + 1) }}>＋ 添加演示生词</button></section>
  <div className="word-table"><div className="word-row heading"><span>单词</span><span>中文</span><span>掌握度</span><span>下次复习</span></div>{cards.length ? cards.map(card => <div className="word-row" key={card.id}><b>{card.word}</b><span>{card.translation}</span><span><i className="mastery" style={{'--level': `${card.mastery * 20}%`} as React.CSSProperties}/>{card.mastery}/5</span><small>{new Date(card.nextReviewAt).toLocaleDateString()}</small></div>) : <div className="empty"><b>Aa</b><h3>还没有生词</h3><p>在题目中点击单词卡，或用右上角按钮添加一个演示词。</p></div>}</div></>
}

const eventNames: Record<string,string> = { login:'登录系统', logout:'退出系统', content_open:'打开内容', answer_change:'作答记录', submission:'提交答案', analysis_open:'展开解析', translation_open:'展开翻译', word_saved:'保存生词', word_reviewed:'复习生词', audio_played:'播放听力', print:'打印试卷', sync_started:'开始同步', sync_completed:'同步完成', sync_failed:'同步失败' }

function Records({ user }: { user: AppUser }) {
  const [version, setVersion] = useState(0)
  const [studentEvents, setStudentEvents] = useState<TeacherActivityRow[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  useEffect(() => { const fn = () => setVersion(v => v + 1); addEventListener('els:data-change', fn); return () => removeEventListener('els:data-change', fn) }, [])
  async function loadStudents() {
    if (user.role !== 'teacher' || !isCloudConfigured) return
    setLoadingStudents(true)
    try { setStudentEvents(await fetchTeacherActivity()) } finally { setLoadingStudents(false) }
  }
  useEffect(() => { void loadStudents() }, [user.id])
  const events = useMemo(() => getEvents().filter(e => e.userId === user.id), [user.id, version])
  const pending = events.filter(e => !e.synced).length
  async function sync() {
    activityLog(user, 'sync_started', { pending })
    try {
      const result = await syncAll(user, getEvents())
      if (result.ok) { markEventsSynced(result.ids); activityLog(user, 'sync_completed', { count: result.count, cards: result.cards, state: result.state }); await loadStudents() }
      else alert('云端尚未配置。记录已安全保存在本机，接入 Supabase 后即可同步。')
    } catch (error) { activityLog(user, 'sync_failed', { message: String(error) }); alert('同步失败，记录仍保存在本机。') }
  }
  const total = user.role === 'teacher' ? studentEvents.length : events.length
  return <><section className="record-summary"><div><p>{user.role === 'teacher' ? '学生学习事件' : '学习事件'}</p><b>{total}</b><small>{user.role === 'teacher' ? '仅显示已关联学生' : '按发生顺序永久保留'}</small></div><div><p>本机等待同步</p><b>{pending}</b><small>{cloud ? '云端已配置' : '当前为本机模式'}</small></div><button className="primary compact" onClick={sync}>立即同步 <span>↻</span></button></section>
  <section className="timeline"><h2>{user.role === 'teacher' ? '学生最近操作' : '最近操作'}</h2>{user.role === 'teacher' ? (loadingStudents ? <div className="empty"><p>正在读取学生记录…</p></div> : studentEvents.length ? studentEvents.map(event => <div className="timeline-item" key={event.id}><i className="synced"/><div><b>{event.studentName} · {eventNames[event.eventType] || event.eventType}</b><p>{event.studentCode} · {event.contentId ? `内容：${event.contentId}` : JSON.stringify(event.payload)}</p></div><small>{new Date(event.occurredAt).toLocaleString()}<em>云端记录</em></small></div>) : <div className="empty"><b>↗</b><h3>还没有学生记录</h3><p>创建或关联学生后，其同步过的学习操作会显示在这里。</p></div>) : (events.length ? events.slice(0,50).map(event => <div className="timeline-item" key={event.id}><i className={event.synced ? 'synced' : ''}/><div><b>{eventNames[event.type] || event.type}</b><p>{event.contentId ? `内容：${event.contentId}` : JSON.stringify(event.payload)}</p></div><small>{new Date(event.occurredAt).toLocaleString()}<em>{event.synced ? '已同步' : '待同步'}</em></small></div>) : <div className="empty"><b>↗</b><h3>记录从现在开始</h3><p>打开内容、答题、保存生词等操作都会出现在这里。</p></div>)}</section></>
}

function Settings({ user }: { user: AppUser }) {
  const [studentCode, setStudentCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [newSecret, setNewSecret] = useState('')
  const [confirmSecret, setConfirmSecret] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  async function submitStudent(event: React.FormEvent) {
    event.preventDefault()
    if (!/^[A-Za-z][A-Za-z0-9_-]{2,19}$/.test(studentCode.trim())) return setMessage('学生编号需以字母开头，共 3—20 位。')
    if (!/^\d{6}$/.test(pin)) return setMessage('PIN 必须是 6 位数字。')
    if (!displayName.trim()) return setMessage('请填写学生姓名。')
    setCreating(true); setMessage('')
    try {
      const student = await createStudent(studentCode, pin, displayName)
      setMessage(`已创建：${student.displayName}（${student.studentCode}）`)
      setStudentCode(''); setDisplayName(''); setPin('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建学生失败')
    } finally { setCreating(false) }
  }
  async function submitPassword(event: React.FormEvent) {
    event.preventDefault()
    if (user.role === 'student' ? !/^\d{6}$/.test(newSecret) : newSecret.length < 8) return setPasswordMessage(user.role === 'student' ? '新 PIN 必须是 6 位数字。' : '新密码至少需要 8 位。')
    if (newSecret !== confirmSecret) return setPasswordMessage('两次输入不一致。')
    setChangingPassword(true); setPasswordMessage('')
    try {
      await updateOwnPassword(newSecret)
      setNewSecret(''); setConfirmSecret(''); setPasswordMessage(user.role === 'student' ? 'PIN 已更新。' : '登录密码已更新。')
    } catch (error) { setPasswordMessage(error instanceof Error ? error.message : '更新失败') }
    finally { setChangingPassword(false) }
  }
  return <><div className="settings-grid"><article><span>01</span><div><h3>解析开放方式</h3><p>默认仅教师可见。后续可按“提交后 / 定时 / 教师手动”控制。</p></div><b>仅教师</b></article><article><span>02</span><div><h3>本机数据</h3><p>离线时继续记录；联网后发送待同步事件，不覆盖原始历史。</p></div><b>已启用</b></article><article><span>03</span><div><h3>账号安全</h3><p>{user.role === 'teacher' ? '教师使用邮箱与密码；学生 PIN 由教师单独创建。' : '学生使用编号与 6 位 PIN，不接触教师权限。'}</p></div><b>角色隔离</b></article><article><span>04</span><div><h3>数据保留</h3><p>学习记录长期保留；删除内容进入 30 天回收站，学期可归档。</p></div><b>长期保留</b></article></div>
  {user.role === 'teacher' && <form className="student-console" onSubmit={submitStudent}><div><p className="eyebrow">STUDENT ACCESS</p><h2>创建学生登录账号</h2><p>学生使用编号和 6 位 PIN 登录；账号会自动归入你的学生名单。</p></div><label>学生姓名<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="例如：李明" /></label><label>学生编号<input value={studentCode} onChange={event => setStudentCode(event.target.value.toUpperCase())} placeholder="例如：S1001" /></label><label>6 位 PIN<input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" type="password" placeholder="••••••" /></label><button className="primary compact" disabled={creating || !isCloudConfigured}>{creating ? '创建中…' : isCloudConfigured ? '创建账号 →' : '等待云端接通'}</button>{message && <p className="console-message">{message}</p>}</form>}
  <form className="password-console" onSubmit={submitPassword}><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>{user.role === 'student' ? '修改登录 PIN' : '修改登录密码'}</h2><p>新凭据只交给 Supabase Auth 处理，不保存到学习记录或本机明文文件。</p></div><label>{user.role === 'student' ? '新 6 位 PIN' : '新密码'}<input value={newSecret} onChange={event => setNewSecret(user.role === 'student' ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} type="password" inputMode={user.role === 'student' ? 'numeric' : 'text'} /></label><label>再次输入<input value={confirmSecret} onChange={event => setConfirmSecret(user.role === 'student' ? event.target.value.replace(/\D/g, '').slice(0, 6) : event.target.value)} type="password" inputMode={user.role === 'student' ? 'numeric' : 'text'} /></label><button className="primary compact" disabled={changingPassword || !isCloudConfigured}>{changingPassword ? '更新中…' : isCloudConfigured ? '确认更新 →' : '等待云端接通'}</button>{passwordMessage && <p className="console-message">{passwordMessage}</p>}</form>
  </>
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(() => {
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('qa') === 'student') {
      return { id: 'student:S1001', role: 'student', displayName: 'S1001', studentCode: 'S1001' }
    }
    try {
      const restored = JSON.parse(localStorage.getItem('els.current-user.v1') || 'null') as AppUser | null
      if (isCloudConfigured && restored && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(restored.id)) {
        localStorage.removeItem('els.current-user.v1')
        return null
      }
      return restored
    } catch { return null }
  })
  const [view, setView] = useState<View>('home')
  const [readerItem, setReaderItem] = useState<ContentItem | null>(null)
  if (!user) return <Login onLogin={setUser} />
  const titles: Record<View,string> = { home:'今天', library:'内容库', reader:'题目', dictation:'默听写', words:'生词本', records:'学习记录', settings:'设置' }
  function openReader(item: ContentItem) { setReaderItem(item); setView('reader') }
  async function logout() { activityLog(user, 'logout'); await signOutCloud(); localStorage.removeItem('els.current-user.v1'); setUser(null) }
  return <div className="app-shell"><Sidebar view={view} setView={setView} user={user} onLogout={logout}/><main className="workspace"><Topbar title={titles[view]}/><div className={`page-content ${view === 'reader' ? 'reader-page' : ''}`}>{view === 'home' && <Home user={user} go={setView}/>} {view === 'library' && <Library user={user} onOpen={openReader}/>} {view === 'reader' && readerItem && <ContentReader user={user} item={readerItem} onBack={() => setView('library')}/>} {view === 'dictation' && <Dictation user={user}/>} {view === 'words' && <Words user={user}/>} {view === 'records' && <Records user={user}/>} {view === 'settings' && <Settings user={user}/>}</div></main></div>
}
