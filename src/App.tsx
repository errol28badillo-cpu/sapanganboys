import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, LayoutDashboard, LogOut, Settings, ShieldCheck, Users } from 'lucide-react'
import AdminWorkspace from './AdminWorkspace'
import type { AdminSection } from './AdminWorkspace'
import { supabase } from './lib/supabase'
import { AboutPage, BoyProfilePage, BoysDirectory, ContactPage, EventsPage, PublicHome } from './PublicPages'

type AdminStatus = 'checking' | 'allowed' | 'signed-out' | 'blocked'
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
}

function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('sapangan-install-dismissed') === '1')

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  if (!prompt) return null

  const install = async () => {
    await prompt.prompt()
    setPrompt(null)
  }

  const dismiss = () => {
    localStorage.setItem('sapangan-install-dismissed', '1')
    setDismissed(true)
  }

  if (dismissed) return null

  return <aside className="install-notice" role="dialog" aria-label="Install Sapangan Boys">
    <div className="install-notice-icon">SB</div>
    <div className="install-notice-copy"><strong>Install Sapangan Boys?</strong><span>Keep the community directory on your device.</span></div>
    <div className="install-notice-actions"><button className="install-confirm" type="button" onClick={() => void install()}>Install</button><button className="install-dismiss" type="button" onClick={dismiss}>Not now</button></div>
  </aside>
}

function AdminLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!supabase) {
      setError('Supabase is not configured for this deployment.')
      return
    }

    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error || !result.data.user) {
      setError(result.error?.message || 'Unable to sign in.')
      return
    }

    const { data, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', result.data.user.id)
      .maybeSingle()

    if (adminError || !data) {
      await supabase.auth.signOut()
      setError('This account is not authorized for the admin dashboard.')
      return
    }

    nav('/admin/dashboard')
  }

  return <div className="login-page">
    <Link to="/" className="brand"><span className="brand-mark">SB</span><span>Sapangan <i>Boys</i></span></Link>
    <form className="login-card" onSubmit={submit}>
      <span className="eyebrow">Admin workspace</span>
      <h1>Welcome back.</h1>
      <p>Sign in to manage community profiles and events.</p>
      <label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="admin@example.com" /></label>
      <label>Password<input type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" /></label>
      {error && <small className="form-error">{error}</small>}
      <button className="button button-dark" type="submit">Sign in <ArrowRight size={16} /></button>
      <small>Public visitors do not need an account.</small>
    </form>
  </div>
}

function AdminGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminStatus>('checking')

  useEffect(() => {
    let active = true
    const verify = async () => {
      if (!supabase) {
        if (active) setStatus('signed-out')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) {
        if (active) setStatus('signed-out')
        return
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (active) setStatus(!error && data ? 'allowed' : 'blocked')
    }

    void verify()
    const { data: listener } = supabase?.auth.onAuthStateChange(() => { void verify() }) || { data: { subscription: { unsubscribe: () => undefined } } }
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (status === 'checking') return <div className="empty page"><p>Checking admin session...</p></div>
  if (status === 'signed-out') return <Navigate to="/admin/login" replace />
  if (status === 'blocked') return <div className="login-page"><div className="login-card"><ShieldCheck size={24} /><h1>Admin only.</h1><p>This account is signed in but is not on the Sapangan Boys admin allowlist.</p><Link className="button button-dark" to="/admin/login">Back to login</Link></div></div>
  return children
}

function AdminLayout({ children }: { children: ReactNode }) {
  const nav = useNavigate()
  const today = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())

  return <div className="admin-shell">
    <aside className="admin-side">
      <Link to="/admin/dashboard" className="brand"><span className="brand-mark">SB</span><span>Sapangan <i>Boys</i></span></Link>
      <div className="admin-label">Workspace</div>
      <NavLink to="/admin/dashboard"><LayoutDashboard size={17} /> Dashboard</NavLink>
      <NavLink to="/admin/boys"><Users size={17} /> Boys</NavLink>
      <NavLink to="/admin/events"><CalendarDays size={17} /> Events</NavLink>
      <NavLink to="/admin/settings"><Settings size={17} /> Settings</NavLink>
      <div className="admin-label">Account</div>
      <button onClick={async () => { await supabase?.auth.signOut(); nav('/admin/login') }}><LogOut size={17} /> Logout</button>
    </aside>
    <div className="admin-main">
      <header className="admin-top"><span>{today}</span><Link to="/" className="view-site">View public site <ArrowUpRight size={15} /></Link></header>
      {children}
    </div>
  </div>
}

function AdminPage({ section }: { section: AdminSection }) {
  return <AdminGuard><AdminLayout><AdminWorkspace section={section} /></AdminLayout></AdminGuard>
}

export default function App() {
  return <><InstallPrompt /><Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/boys" element={<BoysDirectory />} />
      <Route path="/profile/:id" element={<BoyProfilePage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<AdminPage section="dashboard" />} />
      <Route path="/admin/boys" element={<AdminPage section="boys" />} />
      <Route path="/admin/events" element={<AdminPage section="events" />} />
      <Route path="/admin/settings" element={<AdminPage section="settings" />} />
      <Route path="/admin/manage" element={<Navigate to="/admin/boys" replace />} />
      <Route path="/admin/profiles" element={<Navigate to="/admin/boys" replace />} />
      <Route path="/admin/profiles/new" element={<Navigate to="/admin/boys" replace />} />
      <Route path="/admin/categories" element={<Navigate to="/admin/settings" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></>
}
