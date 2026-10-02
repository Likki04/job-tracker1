import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { STATUSES, type Dash, type Interview, type Job, type JobIn, type Match, type Resume, type Skill } from './types'

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled')
const blank = (): JobIn => ({
  company: '', role: '', location: '', salary: '', status: 'Applied', applied_date: today(),
  deadline: null, job_description: '', resume_id: null,
})

// Keep words readable while blocking punctuation and special characters.
const lettersOnly = (value: string) => value.replace(/[^a-zA-Z\s]/g, '')
const lettersAndNumbersOnly = (value: string) => value.replace(/[^a-zA-Z0-9\s]/g, '')

// Brand logos / colors for popular companies
const BRAND_PRESETS: Record<string, { bg: string; color: string }> = {
  google: { bg: '#4285F4', color: '#ffffff' },
  amazon: { bg: '#FF9900', color: '#ffffff' },
  microsoft: { bg: '#00A4EF', color: '#ffffff' },
  apple: { bg: '#1e293b', color: '#ffffff' },
  meta: { bg: '#0668E1', color: '#ffffff' },
  facebook: { bg: '#1877F2', color: '#ffffff' },
  netflix: { bg: '#E50914', color: '#ffffff' },
  spotify: { bg: '#1DB954', color: '#ffffff' },
  uber: { bg: '#0f172a', color: '#ffffff' },
  airbnb: { bg: '#FF5A5F', color: '#ffffff' },
  stripe: { bg: '#635BFF', color: '#ffffff' },
  github: { bg: '#24292F', color: '#ffffff' },
  linkedin: { bg: '#0A66C2', color: '#ffffff' },
  openai: { bg: '#10a37f', color: '#ffffff' },
}

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
]

function CompanyBadge({ name }: { name: string }) {
  const key = name.trim().toLowerCase()
  const brand = BRAND_PRESETS[key]
  const initial = (name.trim()[0] || 'J').toUpperCase()

  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i)
  const grad = GRADIENTS[Math.abs(hash) % GRADIENTS.length]

  return (
    <span
      className="company-badge"
      style={{
        background: brand?.bg || grad,
        color: brand?.color || '#ffffff',
      }}
      title={name}
    >
      {initial}
    </span>
  )
}

export default function App() {
  const [tab, setTab] = useState<'dashboard' | 'applications' | 'profile'>('dashboard')
  const [jobs, setJobs] = useState<Job[]>([])
  const [resumes, setResumes] = useState<Resume[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [dash, setDash] = useState<Dash | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Job | 'new' | null>(null)
  const [error, setError] = useState('')

  // Theme Management (Light / Dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('job_tracker_theme') as 'light' | 'dark' | null
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('job_tracker_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ q, status: statusFilter })
      const [j, r, s, d] = await Promise.all([
        api.get<Job[]>('/applications?' + p), api.get<Resume[]>('/resumes'),
        api.get<Skill[]>('/skills'), api.get<Dash>('/dashboard'),
      ])
      setJobs(j); setResumes(r); setSkills(s); setDash(d); setError('')
    } catch { setError('Cannot reach the API. Is the backend running on port 8000?') }
  }, [q, statusFilter])

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [load])

  return (
    <div className="shell">
      <header>
        <h1><span className="logo">J</span>Job Tracker</h1>
        <nav>
          {(['dashboard', 'applications', 'profile'] as const).map(t => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t === 'profile' ? 'Skills & resumes' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            <span className="theme-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="theme-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button className="primary" onClick={() => setEditing('new')}>+ Add application</button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}

      {tab === 'dashboard' && dash && (
        <Dashboard
          d={dash}
          onNew={() => setEditing('new')}
          onViewApps={() => setTab('applications')}
          onOpenInterview={async (applicationId) => {
            try {
              const job = await api.get<Job>('/applications/' + applicationId)
              setEditing(job)
            } catch {
              setError('Could not open this application. Please try again.')
            }
          }}
        />
      )}

      {tab === 'applications' && (
        <section>
          <div className="filters">
            <input placeholder="Search company, role, location, description" value={q} onChange={e => setQ(e.target.value)} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {jobs.length === 0 && <div className="empty">No applications yet. Click “Add application” to track your first one.</div>}
          <ul className="jobs">
            {jobs.map((j, i) => (
              <li key={j.id} style={{ '--i': i } as React.CSSProperties} onClick={() => setEditing(j)}>
                <div className="job-main">
                  <CompanyBadge name={j.company} />
                  <div className="job-info">
                    <strong>{j.role}</strong> <span className="at-company">at {j.company}</span>
                    <div className="muted">{[j.location, j.salary].filter(Boolean).join(' • ') || 'No location or salary'}</div>
                  </div>
                </div>
                <div className="right">
                  <span className={'pill ' + j.status}>{j.status}</span>
                  <div className="muted">{j.interviews.length} interview(s) • applied {j.applied_date}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'profile' && <Profile skills={skills} resumes={resumes} reload={load} />}

      {editing && (
        <JobModal job={editing === 'new' ? null : editing} resumes={resumes}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} reload={load} />
      )}
    </div>
  )
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return }
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - t0) / 800, 1)
      setN(+(to * (1 - (1 - p) ** 3)).toFixed(1))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{n}{suffix}</>
}

function Dashboard({ d, onNew, onViewApps, onOpenInterview }: {
  d: Dash; onNew: () => void; onViewApps: () => void; onOpenInterview: (applicationId: number) => void
}) {
  const stats: [string, number, string][] = [
    ['Applications this month', d.this_month, ''], ['Interviews', d.interviews, ''],
    ['Offers', d.offers, ''], ['Rejection rate', d.rejection_rate, '%'],
  ]
  return (
    <section>
      {/* Visual Hero Banner with Illustration */}
      <div className="hero-card">
        <div className="hero-text">
          <div className="hero-badge">🚀 Career Growth Tracker</div>
          <h2>Land Your Dream Role Faster</h2>
          <p>
            Track every application, schedule upcoming interview rounds, and benchmark your skills against job requirements.
          </p>
          <div className="hero-btns">
            <button className="primary" onClick={onNew}>+ Add Application</button>
            <button className="ghost-btn" onClick={onViewApps}>Browse Applications ({d.total})</button>
          </div>
        </div>
        <div className="hero-graphic">
          <img src="/images/hero-career.svg" alt="Career Advancement Journey Illustration" />
        </div>
      </div>

      <div className="stats">
        {stats.map(([l, v, u], i) => (
          <div key={l} className="stat" style={{ '--i': i } as React.CSSProperties}>
            <b><CountUp to={v} suffix={u} /></b>
            <span>{l}</span>
          </div>
        ))}
      </div>

      <div className="two">
        <div className="panel">
          <h2>Pipeline</h2>
          {STATUSES.map((s, i) => (
            <div key={s} className="bar">
              <span>{s}</span>
              <b><i className={s} style={{ width: `${d.total ? (100 * d.by_status[s]) / d.total : 0}%`, '--i': i } as React.CSSProperties} /></b>
              <em>{d.by_status[s]}</em>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>Upcoming interviews</h2>
          {d.upcoming.length === 0 && (
            <div className="empty-upcoming">
              <span className="empty-calendar-icon">📅</span>
              <p><strong>Nothing scheduled right now</strong></p>
              <span className="muted">Log your interview rounds inside any application to track them here.</span>
            </div>
          )}
          {d.upcoming.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className="up"
              style={{ '--i': i } as React.CSSProperties}
              onClick={() => onOpenInterview(u.application_id)}
              aria-label={`Open ${u.round} interview details for ${u.role} at ${u.company}`}
            >
              <span className="up-content">
                <strong>{u.company}</strong>
                <span className="up-role">{u.role}</span>
                <span className="up-round">{u.round}</span>
                <time className="up-date" dateTime={u.scheduled_at}>{fmt(u.scheduled_at)}</time>
              </span>
              <span className="up-open">Open details <span aria-hidden="true">→</span></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function Profile({ skills, resumes, reload }: { skills: Skill[]; resumes: Resume[]; reload: () => void }) {
  const [skill, setSkill] = useState('')
  const [rName, setRName] = useState('')
  const [rNotes, setRNotes] = useState('')
  return (
    <section>
      {/* Profile Banner with Skills Illustration */}
      <div className="profile-banner">
        <div className="profile-banner-text">
          <div className="hero-badge">✨ AI Skill Matcher</div>
          <h2>Supercharge Your Resumes</h2>
          <p>
            Add your key technical skills below. Whenever you paste a job description into an application,
            Job Tracker compares requirements and scores your match!
          </p>
        </div>
        <div className="profile-banner-graphic">
          <img src="/images/skills-growth.svg" alt="Skills Analysis Illustration" />
        </div>
      </div>

      <div className="two">
        <div className="panel">
          <h2>Your skills</h2>
          <p className="muted">These are compared against each job description.</p>
          <form className="row" onSubmit={async e => { e.preventDefault(); if (skill.trim()) { await api.post('/skills', { name: skill }); setSkill(''); reload() } }}>
            <input placeholder="e.g. Python, React, Docker" value={skill} onChange={e => setSkill(e.target.value)} />
            <button className="primary">Add skill</button>
          </form>
          <div className="chips">{skills.map(s => <span key={s.id} className="chip">{s.name}<button onClick={async () => { await api.del('/skills/' + s.id); reload() }}>x</button></span>)}</div>
        </div>
        <div className="panel">
          <h2>Resume versions</h2>
          <form className="col" onSubmit={async e => { e.preventDefault(); if (rName.trim()) { await api.post('/resumes', { name: rName, notes: rNotes }); setRName(''); setRNotes(''); reload() } }}>
            <input placeholder="Version name, e.g. Backend v3" value={rName} onChange={e => setRName(e.target.value)} />
            <input placeholder="What changed in this version?" value={rNotes} onChange={e => setRNotes(e.target.value)} />
            <button className="primary">Save version</button>
          </form>
          {resumes.map(r => <p key={r.id}><strong>{r.name}</strong> <button className="link" onClick={async () => { await api.del('/resumes/' + r.id); reload() }}>Delete</button><br /><span className="muted">{r.notes}</span></p>)}
        </div>
      </div>
    </section>
  )
}

function JobModal({ job, resumes, onClose, onSaved, reload }: {
  job: Job | null; resumes: Resume[]; onClose: () => void; onSaved: () => void; reload: () => void
}) {
  const [f, setF] = useState<JobIn>(job ? { ...job } : blank())
  const [ivs, setIvs] = useState<Interview[]>(job?.interviews ?? [])
  const [match, setMatch] = useState<Match | null>(null)
  const [iv, setIv] = useState({ round: '', when: '', notes: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'company' | 'role' | 'location' | 'salary' | 'job_description', string>>>({})
  const set = <K extends keyof JobIn>(k: K, v: JobIn[K]) => setF(p => ({ ...p, [k]: v }))
  const setFiltered = (
    key: 'company' | 'role' | 'location' | 'salary' | 'job_description',
    value: string,
    filter: (input: string) => string,
    message: string,
  ) => {
    const filtered = filter(value)
    set(key, filtered)
    setFieldErrors(current => ({ ...current, [key]: filtered === value ? undefined : message }))
  }

  const analyse = async () => setMatch(await api.post<Match>('/extract-skills', { text: f.job_description }))
  useEffect(() => { if (job?.job_description) analyse() }, []) // eslint-disable-line

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (job) await api.put('/applications/' + job.id, f); else await api.post('/applications', f)
    onSaved()
  }
  const addIv = async () => {
    if (!job || !iv.round.trim()) return
    const created = await api.post<Interview>(`/applications/${job.id}/interviews`, { round: iv.round, scheduled_at: iv.when || null, notes: iv.notes })
    setIvs([...ivs, created]); setIv({ round: '', when: '', notes: '' }); reload()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{job ? 'Edit application' : 'New application'}</h2>
        <form onSubmit={save} className="grid">
          <label>Company
            <input required value={f.company} aria-invalid={Boolean(fieldErrors.company)} aria-describedby={fieldErrors.company ? 'company-error' : undefined}
              onChange={e => setFiltered('company', e.target.value, lettersAndNumbersOnly, 'Enter only letters and numbers.')} />
            {fieldErrors.company && <span id="company-error" className="field-error" role="alert">{fieldErrors.company}</span>}
          </label>
          <label>Role
            <input required value={f.role} aria-invalid={Boolean(fieldErrors.role)} aria-describedby={fieldErrors.role ? 'role-error' : undefined}
              onChange={e => setFiltered('role', e.target.value, lettersOnly, 'Enter only letters.')} />
            {fieldErrors.role && <span id="role-error" className="field-error" role="alert">{fieldErrors.role}</span>}
          </label>
          <label>Location
            <input value={f.location} aria-invalid={Boolean(fieldErrors.location)} aria-describedby={fieldErrors.location ? 'location-error' : undefined}
              onChange={e => setFiltered('location', e.target.value, lettersOnly, 'Enter only letters.')} />
            {fieldErrors.location && <span id="location-error" className="field-error" role="alert">{fieldErrors.location}</span>}
          </label>
          <label>Salary
            <input value={f.salary} aria-invalid={Boolean(fieldErrors.salary)} aria-describedby={fieldErrors.salary ? 'salary-error' : undefined}
              onChange={e => setFiltered('salary', e.target.value, lettersAndNumbersOnly, 'Enter only letters and numbers.')} />
            {fieldErrors.salary && <span id="salary-error" className="field-error" role="alert">{fieldErrors.salary}</span>}
          </label>
          <label>Status<select value={f.status} onChange={e => set('status', e.target.value as JobIn['status'])}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Resume version<select value={f.resume_id ?? ''} onChange={e => set('resume_id', e.target.value ? +e.target.value : null)}>
            <option value="">None</option>{resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>Applied on<input type="date" required value={f.applied_date} onChange={e => set('applied_date', e.target.value)} /></label>
          <label>Deadline<input type="date" value={f.deadline ?? ''} onChange={e => set('deadline', e.target.value || null)} /></label>
          <label className="full">Job description
            <textarea rows={6} value={f.job_description} aria-invalid={Boolean(fieldErrors.job_description)} aria-describedby={fieldErrors.job_description ? 'job-description-error' : undefined}
              onChange={e => setFiltered('job_description', e.target.value, lettersAndNumbersOnly, 'Enter only letters and numbers.')} placeholder="Paste the job description here" />
            {fieldErrors.job_description && <span id="job-description-error" className="field-error" role="alert">{fieldErrors.job_description}</span>}
          </label>
          <div className="full row">
            <button type="button" onClick={analyse}>Compare with my skills</button>
            <span className="grow" />
            {job && <button type="button" className="danger" onClick={async () => { if (confirm('Delete this application?')) { await api.del('/applications/' + job.id); onSaved() } }}>Delete</button>}
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary">Save application</button>
          </div>
        </form>

        {match && (
          <div className="match">
            <h3>Skill match: {match.score}%</h3>
            <div className="meter"><i style={{ width: match.score + '%' }} /></div>
            {match.extracted.length === 0 ? <p className="muted">No known skills found in this description.</p> : <>
              <div className="chips">{match.matched.map(s => <span key={s} className="chip ok">{s}</span>)}{match.missing.map(s => <span key={s} className="chip gap">{s}</span>)}</div>
              <p className="muted">Green: you have it. Red: add it to your skills or work on it before applying.</p></>}
          </div>
        )}

        {job && (
          <div>
            <h3>Interviews</h3>
            {ivs.map(i => (
              <div key={i.id} className="iv">
                <div className="row"><strong>{i.round}</strong><span className="muted grow">{fmt(i.scheduled_at)}</span>
                  <button className="link" onClick={async () => { await api.del('/interviews/' + i.id); setIvs(ivs.filter(x => x.id !== i.id)); reload() }}>Remove</button></div>
                <textarea rows={2} defaultValue={i.notes} placeholder="Notes" onBlur={e => api.put('/interviews/' + i.id, { round: i.round, scheduled_at: i.scheduled_at, notes: e.target.value })} />
              </div>
            ))}
            <div className="row">
              <input placeholder="Round, e.g. Technical" value={iv.round} onChange={e => setIv({ ...iv, round: e.target.value })} />
              <input type="datetime-local" value={iv.when} onChange={e => setIv({ ...iv, when: e.target.value })} />
              <button onClick={addIv}>Add interview</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
