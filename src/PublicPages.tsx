import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, Facebook, Flame, MapPin, Menu, Moon, Search, ShieldCheck, Sparkles, Star, Sun, Users, X } from 'lucide-react'
import { profiles as seedProfiles } from './data'
import { supabase } from './lib/supabase'
import { useSiteContent } from './lib/siteContent'
import type { CommunityEvent, Profile } from './types'

type LoadableProfiles = {
  profiles: Profile[]
  loading: boolean
  error: string
}

type SupabaseProfileRow = Omit<Profile, 'category'> & {
  category?: { name?: string } | { name?: string }[] | null
}

const fallbackAvatar = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Sapangan Boy')}&background=d7e5db&color=183d34&size=900`
const defaultInterests = ['Basketball', 'Gaming', 'Music', 'Motorcycles', 'Photography', 'Sports', 'Art', 'Technology', 'Fitness']
const formatDate = (date: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

function normalizeProfile(item: SupabaseProfileRow): Profile {
  const category = Array.isArray(item.category) ? item.category[0]?.name : item.category?.name
  return {
    ...item,
    category,
    gallery_urls: item.gallery_urls || [],
    hobbies: item.hobbies || [],
    interests: item.interests || [],
    fun_facts: item.fun_facts || [],
    views: item.views || 0,
  }
}

function facebookUrl(value?: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    if (hostname === 'facebook.com' || hostname.endsWith('.facebook.com') || hostname === 'fb.com' || hostname.endsWith('.fb.com')) {
      url.protocol = 'https:'
      return url.toString()
    }
  } catch {
    return ''
  }
  return ''
}

function profileImages(profile: Profile) {
  return Array.from(new Set([profile.profile_image_url, ...(profile.gallery_urls || [])].filter(Boolean)))
}

function usePublicProfiles(): LoadableProfiles {
  const [profiles, setProfiles] = useState<Profile[]>(supabase ? [] : seedProfiles.filter(profile => profile.is_published))
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true

    const load = async () => {
      setLoading(true)
      const { data, error: requestError } = await client
        .from('profiles')
        .select('*, category:categories(name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (!active) return
      if (requestError) {
        setError(requestError.message)
        setProfiles([])
      } else {
        setError('')
        setProfiles(((data || []) as SupabaseProfileRow[]).map(normalizeProfile))
      }
      setLoading(false)
    }

    void load()
    const channel = client
      .channel('public-profiles-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void load() })
      .subscribe(status => { if (status === 'SUBSCRIBED') void load() })

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [])

  return { profiles, loading, error }
}

function usePublicEvents() {
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true

    const load = async () => {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const { data, error: requestError } = await client
        .from('events')
        .select('*')
        .eq('is_published', true)
        .gte('date', today)
        .order('date', { ascending: true })

      if (!active) return
      if (requestError) {
        setError(requestError.message)
        setEvents([])
      } else {
        setError('')
        setEvents((data || []) as CommunityEvent[])
      }
      setLoading(false)
    }

    void load()
    const channel = client
      .channel('public-events-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void load() })
      .subscribe(status => { if (status === 'SUBSCRIBED') void load() })

    return () => {
      active = false
      void client.removeChannel(channel)
    }
  }, [])

  return { events, loading, error }
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('sb-theme') === 'dark'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', dark)
    localStorage.setItem('sb-theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark(value => !value) }
}

function PublicImage({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <img className={className} src={!failed && src ? src : fallbackAvatar(name)} alt={name} loading="lazy" onError={() => setFailed(true)} />
}

function PublicHeader() {
  const [open, setOpen] = useState(false)
  const theme = useTheme()
  const close = () => setOpen(false)

  return <header className="site-header">
    <Link to="/" className="brand" onClick={close}><span className="brand-mark">SB</span><span>Sapangan <i>Boys</i></span></Link>
    <button className="menu-toggle" onClick={() => setOpen(value => !value)} aria-label="Toggle navigation"><Menu size={22} /></button>
    <nav className={open ? 'nav open' : 'nav'}>
      <Link to="/" onClick={close}>Home</Link>
      <Link to="/boys" onClick={close}>Boys</Link>
      <Link to="/boys#interests" onClick={close}>Interests</Link>
      <Link to="/events" onClick={close}>Events</Link>
      <Link to="/about" onClick={close}>About</Link>
      <button className="theme-toggle" onClick={theme.toggle} aria-label={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}>{theme.dark ? <Sun size={16} /> : <Moon size={16} />}</button>
      <Link to="/admin/login" className="nav-admin" onClick={close}>Admin <ArrowUpRight size={15} /></Link>
    </nav>
  </header>
}

function PublicFooter() {
  return <footer>
    <div className="footer-top">
      <Link to="/" className="brand"><span className="brand-mark">SB</span><span>Sapangan <i>Boys</i></span></Link>
      <p>Community Profile Directory for Sapangan, San Juan, Batangas.</p>
      <Link to="/contact" className="footer-action">Request a correction <ArrowRight size={15} /></Link>
    </div>
    <div className="footer-bottom">
      <span>Sapangan Boys</span>
      <span>San Juan, Batangas</span>
      <span>Public profiles use voluntarily provided information.</span>
    </div>
  </footer>
}

function PublicShell({ children }: { children: ReactNode }) {
  return <>
    <PublicHeader />
    {children}
    <PublicFooter />
  </>
}

function SectionTitle({ icon, kicker, title, action }: { icon?: ReactNode; kicker: string; title: string; action?: ReactNode }) {
  return <div className="section-lead">
    <div>
      <span className="eyebrow">{icon}{kicker}</span>
      <h2>{title}</h2>
    </div>
    {action}
  </div>
}

function ProfileGallery({ profile, detail = false, onOpen }: { profile: Profile; detail?: boolean; onOpen?: (image: string) => void }) {
  const images = profileImages(profile)
  const [active, setActive] = useState(0)

  useEffect(() => setActive(0), [profile.id])
  useEffect(() => {
    if (images.length < 2) return
    const timer = window.setInterval(() => setActive(index => (index + 1) % images.length), detail ? 5200 : 3600)
    return () => window.clearInterval(timer)
  }, [detail, images.length])

  const image = images[active] || fallbackAvatar(profile.display_name)
  const move = (direction: number) => setActive(index => (index + direction + images.length) % images.length)

  return <div className={detail ? 'profile-gallery detail-gallery' : 'profile-gallery'}>
    <button className="gallery-image-button" type="button" onClick={() => onOpen?.(image)} aria-label={`Open ${profile.display_name} photo`}>
      <PublicImage src={image} name={profile.display_name} />
    </button>
    {images.length > 1 && <>
      <button className="gallery-control gallery-prev" type="button" onClick={event => { event.preventDefault(); move(-1) }} aria-label="Previous image">‹</button>
      <button className="gallery-control gallery-next" type="button" onClick={event => { event.preventDefault(); move(1) }} aria-label="Next image">›</button>
      <span className="gallery-count">{active + 1} / {images.length}</span>
      {detail && <div className="gallery-strip">{images.map((photo, index) => <button type="button" key={photo} className={index === active ? 'gallery-thumb active' : 'gallery-thumb'} onClick={() => setActive(index)} aria-label={`Show image ${index + 1}`}><PublicImage src={photo} name={`${profile.display_name} thumbnail`} /></button>)}</div>}
    </>}
  </div>
}

function ProfileCard({ profile }: { profile: Profile }) {
  const facebook = facebookUrl(profile.social_links?.facebook)
  return <article className="discovery-card">
    <Link to={`/profile/${profile.id}`} className="discovery-photo">
      <ProfileGallery profile={profile} />
      {profile.featured && <span className="featured-badge"><Star size={12} /> Featured</span>}
    </Link>
    <div className="discovery-card-body">
      <span className="location"><MapPin size={13} /> {profile.location || 'Sapangan'}</span>
      <h3>{profile.nickname || profile.display_name}</h3>
      <p>{profile.short_description}</p>
      <div className="tag-row">{profile.interests.slice(0, 4).map(interest => <Link to={`/boys?interest=${encodeURIComponent(interest)}`} key={interest}>{interest}</Link>)}</div>
      <div className="card-actions">
        <Link className="button button-dark" to={`/profile/${profile.id}`}>View Profile <ArrowRight size={14} /></Link>
        {facebook && <a className="button button-outline" href={facebook} target="_blank" rel="noreferrer">Facebook <ArrowUpRight size={14} /></a>}
      </div>
    </div>
  </article>
}

function EventCard({ event }: { event: CommunityEvent }) {
  return <article className="event-card">
    {event.image_url ? <PublicImage src={event.image_url} name={event.title} /> : <div className="event-image-empty"><CalendarDays size={26} /></div>}
    <div>
      <span className="eyebrow">{formatDate(event.date)}{event.time ? ` - ${event.time}` : ''}</span>
      <h3>{event.title}</h3>
      <p>{event.description}</p>
      {event.location && <span className="location"><MapPin size={13} /> {event.location}</span>}
    </div>
  </article>
}

function SkeletonGrid({ count = 3 }: { count?: number }) {
  return <div className="discovery-grid">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><span /><div><b /><p /><p /></div></div>)}</div>
}

function EmptyState({ icon, title, body, compact = false }: { icon: ReactNode; title: string; body: string; compact?: boolean }) {
  return <div className={compact ? 'empty compact' : 'empty'}>{icon}<h3>{title}</h3><p>{body}</p></div>
}

export function PublicHome() {
  const { profiles, loading } = usePublicProfiles()
  const { events, loading: eventsLoading } = usePublicEvents()
  const content = useSiteContent()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const featured = profiles.filter(profile => profile.featured).slice(0, 3)
  const trending = [...profiles].sort((a, b) => (b.views || 0) - (a.views || 0) || b.created_at.localeCompare(a.created_at)).slice(0, 3)
  const interests = Array.from(new Set(profiles.flatMap(profile => profile.interests))).filter(Boolean).sort()
  const visibleInterests = interests.length ? interests : defaultInterests

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    navigate(query.trim() ? `/boys?q=${encodeURIComponent(query.trim())}` : '/boys')
  }

  return <PublicShell><main className="discovery-home">
    <section className="discovery-hero">
      <div className="hero-copy">
        <span className="eyebrow light"><Sparkles size={13} /> Sapangan, San Juan, Batangas</span>
        <h1>SAPANGAN BOYS</h1>
        <p className="hero-tagline">Meet - Discover - Connect</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <Search size={18} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search boys..." />
          <button className="button button-light" type="submit">Search <ArrowRight size={15} /></button>
        </form>
      </div>
      <div className="hero-mosaic">
        {profiles.slice(0, 4).map((profile, index) => <Link to={`/profile/${profile.id}`} className={`mosaic-tile tile-${index + 1}`} key={profile.id}><PublicImage src={profile.profile_image_url} name={profile.display_name} /></Link>)}
        {!profiles.length && <div className="mosaic-empty"><Users size={34} /><span>Sapangan Boys</span></div>}
      </div>
    </section>

    <section className="discovery-section">
      <SectionTitle icon={<Star size={13} />} kicker="Featured Boys" title="Profiles selected by the admin." action={<Link className="text-link" to="/boys?sort=featured">View all <ArrowRight size={15} /></Link>} />
      {loading ? <SkeletonGrid /> : featured.length ? <div className="discovery-grid">{featured.map(profile => <ProfileCard profile={profile} key={profile.id} />)}</div> : <EmptyState compact icon={<Star size={24} />} title="No featured boys yet." body="Featured profiles will appear here once the admin marks them." />}
    </section>

    <section className="discovery-section muted-band">
      <SectionTitle icon={<Flame size={13} />} kicker="Trending In Sapangan" title="Profiles people are viewing." action={<Link className="text-link" to="/boys?sort=views">Most viewed <ArrowRight size={15} /></Link>} />
      {loading ? <SkeletonGrid /> : trending.length ? <div className="discovery-grid">{trending.map(profile => <ProfileCard profile={profile} key={profile.id} />)}</div> : <EmptyState compact icon={<Flame size={24} />} title="No trending profiles yet." body="Views will build naturally as visitors open profiles." />}
    </section>

    <section className="discovery-section" id="interests">
      <SectionTitle kicker="Discover By Interest" title="Find people through what they enjoy." />
      <div className="interest-chips">{visibleInterests.map(interest => <Link to={`/boys?interest=${encodeURIComponent(interest)}`} key={interest}>{interest}</Link>)}</div>
    </section>

    <section className="discovery-section">
      <SectionTitle icon={<Users size={13} />} kicker="All Boys" title="Browse the public directory." action={<Link className="text-link" to="/boys">Open directory <ArrowRight size={15} /></Link>} />
      {loading ? <SkeletonGrid count={6} /> : profiles.length ? <div className="discovery-grid">{profiles.slice(0, 6).map(profile => <ProfileCard profile={profile} key={profile.id} />)}</div> : <EmptyState icon={<Search size={30} />} title="No boys found." body="Published profiles will appear here after the admin adds them." />}
    </section>

    <section className="discovery-section">
      <SectionTitle icon={<CalendarDays size={13} />} kicker="Community Events" title="Upcoming activities." action={<Link className="text-link" to="/events">See events <ArrowRight size={15} /></Link>} />
      {eventsLoading ? <SkeletonGrid /> : events.length ? <div className="event-grid">{events.slice(0, 3).map(event => <EventCard event={event} key={event.id} />)}</div> : <EmptyState compact icon={<CalendarDays size={24} />} title="No upcoming events at the moment." body="Community events will appear here when published." />}
    </section>
  </main></PublicShell>
}

export function BoysDirectory() {
  const { profiles, loading, error } = usePublicProfiles()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const interest = params.get('interest') || 'All interests'
  const sort = params.get('sort') || 'newest'
  const interests = Array.from(new Set(profiles.flatMap(profile => profile.interests))).filter(Boolean).sort()

  const filtered = useMemo(() => profiles
    .filter(profile => {
      const haystack = [
        profile.display_name,
        profile.nickname || '',
        profile.short_description,
        profile.bio,
        profile.location || '',
        profile.hobbies.join(' '),
        profile.interests.join(' '),
      ].join(' ').toLowerCase()
      return haystack.includes(query.toLowerCase()) && (interest === 'All interests' || profile.interests.includes(interest))
    })
    .sort((a, b) => {
      if (sort === 'views') return (b.views || 0) - (a.views || 0) || b.created_at.localeCompare(a.created_at)
      if (sort === 'featured') return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.created_at.localeCompare(a.created_at)
      return b.created_at.localeCompare(a.created_at)
    }), [interest, profiles, query, sort])

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'All interests' || (key === 'sort' && value === 'newest')) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return <PublicShell><main className="page discovery-directory">
    <div className="directory-head">
      <div>
        <span className="eyebrow">The directory</span>
        <h1>All <em>boys.</em></h1>
        <p>Discover public profiles, interests, and stories from Sapangan.</p>
      </div>
      <div className="directory-count"><b>{filtered.length}</b><span>profiles<br />shown</span></div>
    </div>
    <div className="discovery-filters">
      <div className="search-box"><Search size={18} /><input value={query} onChange={event => updateParam('q', event.target.value)} placeholder="Search boys, nicknames, interests..." /></div>
      <select value={interest} onChange={event => updateParam('interest', event.target.value)}><option>All interests</option>{interests.map(item => <option key={item}>{item}</option>)}</select>
      <select value={sort} onChange={event => updateParam('sort', event.target.value)}><option value="newest">Newest first</option><option value="featured">Featured first</option><option value="views">Most viewed</option></select>
    </div>
    <div id="interests" className="interest-chips filter-chips">
      <button className={interest === 'All interests' ? 'active' : ''} onClick={() => updateParam('interest', 'All interests')}>All interests</button>
      {interests.map(item => <button key={item} className={interest === item ? 'active' : ''} onClick={() => updateParam('interest', item)}>{item}</button>)}
    </div>
    {error && <div className="admin-message">Profiles could not load: {error}</div>}
    {loading ? <SkeletonGrid count={6} /> : filtered.length ? <div className="discovery-grid">{filtered.map(profile => <ProfileCard profile={profile} key={profile.id} />)}</div> : <EmptyState icon={<Search size={30} />} title="No boys found." body="Try another search or category." />}
  </main></PublicShell>
}

export function BoyProfilePage() {
  const { id } = useParams()
  const { profiles, loading } = usePublicProfiles()
  const profile = profiles.find(item => item.id === id)
  const [lightbox, setLightbox] = useState('')

  useEffect(() => {
    if (!profile || !supabase) return
    const today = new Date().toISOString().slice(0, 10)
    const key = `sapangan-profile-view:${profile.id}:${today}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    void supabase.rpc('increment_profile_view', { profile_id: profile.id })
  }, [profile])

  if (loading) return <PublicShell><main className="detail-page"><SkeletonGrid count={1} /></main></PublicShell>
  if (!profile) return <PublicShell><main className="empty page"><h2>Profile not found</h2><Link to="/boys" className="text-link">Back to boys <ArrowRight size={15} /></Link></main></PublicShell>

  const facebook = facebookUrl(profile.social_links?.facebook)
  const facts = (profile.fun_facts || []).filter(Boolean)

  return <PublicShell><main className="detail-page">
    <Link to="/boys" className="back-link">Back to boys</Link>
    <div className="detail-layout modern-detail">
      <div className="detail-image">
        <ProfileGallery profile={profile} detail onOpen={setLightbox} />
        {profile.featured && <span className="featured-badge detail-badge"><Star size={12} /> Featured</span>}
      </div>
      <div className="detail-copy">
        <span className="eyebrow">A Sapangan profile</span>
        <h1>{profile.nickname || profile.display_name}</h1>
        {profile.nickname && <p className="real-name">{profile.display_name}</p>}
        <p className="detail-lede">{profile.short_description}</p>
        <div className="profile-meta">
          <span><MapPin size={14} /> {profile.location || 'Sapangan'}</span>
          <span><Users size={14} /> {(profile.views || 0).toLocaleString()} views</span>
        </div>
        <div className="detail-rule" />
        <p>{profile.bio || 'This profile is ready for more public details when the admin adds them.'}</p>
        <div className="detail-sections">
          <div><b>Hobbies</b><div className="detail-tags">{profile.hobbies.length ? profile.hobbies.map(hobby => <span key={hobby}>{hobby}</span>) : <span>Not added yet</span>}</div></div>
          <div><b>Interests</b><div className="detail-tags">{profile.interests.length ? profile.interests.map(item => <Link to={`/boys?interest=${encodeURIComponent(item)}`} key={item}>{item}</Link>) : <span>Not added yet</span>}</div></div>
          <div><b>Favorite sport</b><p>{profile.favorite_sport || 'Not added yet'}</p></div>
          <div><b>Favorite music</b><p>{profile.favorite_music || 'Not added yet'}</p></div>
        </div>
        {facts.length > 0 && <div className="fun-facts"><b>Fun facts</b>{facts.map(fact => <p key={fact}>{fact}</p>)}</div>}
        {facebook && <a className="button button-dark social-profile-link" href={facebook} target="_blank" rel="noreferrer"><Facebook size={17} /> Connect on Facebook <ArrowUpRight size={15} /></a>}
        <small>Added {formatDate(profile.created_at)}</small>
      </div>
    </div>
    {lightbox && <div className="lightbox" onClick={() => setLightbox('')}>
      <button type="button" aria-label="Close gallery"><X size={18} /></button>
      <img src={lightbox} alt={`${profile.display_name} gallery`} />
    </div>}
  </main></PublicShell>
}

export function EventsPage() {
  const { events, loading, error } = usePublicEvents()
  return <PublicShell><main className="page discovery-directory">
    <div className="directory-head">
      <div>
        <span className="eyebrow">Community calendar</span>
        <h1>Events in <em>Sapangan.</em></h1>
        <p>Upcoming community activities shared by the admin.</p>
      </div>
    </div>
    {error && <div className="admin-message">Events could not load: {error}</div>}
    {loading ? <SkeletonGrid /> : events.length ? <div className="event-grid">{events.map(event => <EventCard event={event} key={event.id} />)}</div> : <EmptyState icon={<CalendarDays size={30} />} title="No Events" body="No upcoming events at the moment." />}
  </main></PublicShell>
}

export function AboutPage() {
  const content = useSiteContent()
  return <PublicShell><main className="simple-page">
    <span className="eyebrow">About the project</span>
    <h1>Sapangan Boys<br /><em>Community Directory</em></h1>
    <p className="large-copy">{content.about_body}</p>
    <div className="about-grid">
      <div><b>Purpose</b><p>Visitors can discover public profiles and connect through voluntarily provided Facebook links.</p></div>
      <div><b>Privacy</b><p>Profiles use general locations only, and the admin can hide or remove a profile when needed.</p></div>
    </div>
    <Link to="/boys" className="button button-dark">Meet the community <ArrowRight size={16} /></Link>
  </main></PublicShell>
}

export function ContactPage() {
  const content = useSiteContent()
  return <PublicShell><main className="simple-page contact-page">
    <span className="eyebrow">Get in touch</span>
    <h1>Keep the community<br /><em>in the loop.</em></h1>
    <p className="large-copy">{content.contact_body}</p>
    <a className="contact-email" href={`mailto:${content.contact_email}`}>{content.contact_email} <ArrowUpRight size={20} /></a>
    <p className="privacy-note"><ShieldCheck size={18} /> Profiles are public by design and should only include information approved for publication.</p>
  </main></PublicShell>
}

export { facebookUrl, profileImages }
