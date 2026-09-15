import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, BarChart3, CalendarDays, Check, Edit3, Eye, EyeOff, ImagePlus, Plus, Save, Settings, ShieldCheck, Star, Trash2, Upload, Users, Video, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { CommunityEvent, Profile, SiteContent } from './types'
import { facebookUrl, profileImages } from './PublicPages'

export type AdminSection = 'dashboard' | 'boys' | 'events' | 'settings'

type ContentRow = { key: keyof SiteContent; value: string }

type ProfileForm = {
  display_name: string
  nickname: string
  short_description: string
  bio: string
  location: string
  hobbies: string
  interests: string
  favorite_sport: string
  favorite_music: string
  fun_facts: string
  facebook: string
  profile_image_url: string
  video_url: string
  gallery_urls: string[]
  featured: boolean
  is_published: boolean
  consent_confirmed: boolean
}

type EventForm = {
  title: string
  description: string
  date: string
  time: string
  location: string
  image_url: string
  is_published: boolean
}

type ConfirmState = {
  title: string
  body: string
  actionLabel: string
  danger?: boolean
  run: () => Promise<void>
}

const emptyProfile: ProfileForm = {
  display_name: '',
  nickname: '',
  short_description: '',
  bio: '',
  location: 'Sapangan',
  hobbies: '',
  interests: '',
  favorite_sport: '',
  favorite_music: '',
  fun_facts: '',
  facebook: '',
  profile_image_url: '',
  video_url: '',
  gallery_urls: [],
  featured: false,
  is_published: false,
  consent_confirmed: false,
}

const emptyEvent: EventForm = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: 'Sapangan',
  image_url: '',
  is_published: false,
}

const splitList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)
const joinList = (value?: string[] | null) => (value || []).join(', ')
const unique = (items: string[]) => Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
const optional = (value: string) => value.trim() || null

function profileToForm(profile?: Profile): ProfileForm {
  if (!profile) return { ...emptyProfile, gallery_urls: [] }
  return {
    display_name: profile.display_name || '',
    nickname: profile.nickname || '',
    short_description: profile.short_description || '',
    bio: profile.bio || '',
    location: profile.location || 'Sapangan',
    hobbies: joinList(profile.hobbies),
    interests: joinList(profile.interests),
    favorite_sport: profile.favorite_sport || '',
    favorite_music: profile.favorite_music || '',
    fun_facts: joinList(profile.fun_facts),
    facebook: profile.social_links?.facebook || '',
    profile_image_url: profile.profile_image_url || '',
    video_url: profile.video_url || '',
    gallery_urls: profile.gallery_urls || [],
    featured: Boolean(profile.featured),
    is_published: profile.is_published,
    consent_confirmed: profile.consent_confirmed,
  }
}

function eventToForm(event?: CommunityEvent): EventForm {
  if (!event) return { ...emptyEvent }
  return {
    title: event.title || '',
    description: event.description || '',
    date: event.date || '',
    time: event.time || '',
    location: event.location || 'Sapangan',
    image_url: event.image_url || '',
    is_published: event.is_published,
  }
}

async function uploadImages(bucket: string, folder: string, files: File[]) {
  const urls: string[] = []
  if (!supabase) return { urls, error: 'Supabase is not configured.' }

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${folder}/${crypto.randomUUID()}.${extension}`
    const upload = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false })
    if (upload.error) return { urls, error: upload.error.message }
    urls.push(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl)
  }

  return { urls, error: '' }
}

function StatusPill({ published }: { published: boolean }) {
  return <span className={published ? 'status' : 'draft-status'}>{published ? 'Published' : 'Hidden'}</span>
}

function AdminImage({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  return <img src={!failed && src ? src : `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Sapangan')}&background=d7e5db&color=183d34&size=300`} alt="" onError={() => setFailed(true)} />
}

export default function AdminWorkspace({ section = 'dashboard' }: { section?: AdminSection }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [content, setContent] = useState<SiteContent>({
    boys_intro: '',
    about_heading: '',
    about_body: '',
    contact_email: '',
    contact_body: '',
  })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileForm>(profileToForm())
  const [profileFiles, setProfileFiles] = useState<File[]>([])
  const [profileVideoFile, setProfileVideoFile] = useState<File | null>(null)
  const [eventEditorOpen, setEventEditorOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CommunityEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventForm>(eventToForm())
  const [eventFile, setEventFile] = useState<File | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const notify = (value: string) => {
    setMessage(value)
    window.setTimeout(() => setMessage(''), 4200)
  }

  const load = async () => {
    if (!supabase) {
      setLoading(false)
      notify('Supabase is not configured for this deployment.')
      return
    }

    setLoading(true)
    const [{ data: profileRows, error: profileError }, { data: eventRows, error: eventError }, { data: contentRows, error: contentError }] = await Promise.all([
      supabase.from('profiles').select('*, category:categories(name)').order('created_at', { ascending: false }),
      supabase.from('events').select('*').order('date', { ascending: true }),
      supabase.from('site_content').select('key,value'),
    ])

    if (profileError) notify(profileError.message)
    else setProfiles(((profileRows || []) as Array<Omit<Profile, 'category'> & { category?: { name?: string } | { name?: string }[] | null }>).map(row => {
      const category = Array.isArray(row.category) ? row.category[0]?.name : row.category?.name
      return { ...row, category, gallery_urls: row.gallery_urls || [], hobbies: row.hobbies || [], interests: row.interests || [], fun_facts: row.fun_facts || [], views: row.views || 0 }
    }))

    if (eventError) notify(eventError.message)
    else setEvents((eventRows || []) as CommunityEvent[])

    if (contentError) notify(contentError.message)
    else if (contentRows) {
      setContent(current => ({
        ...current,
        ...Object.fromEntries(((contentRows || []) as ContentRow[]).map(row => [row.key, row.value])),
      }))
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
    const client = supabase
    if (!client) return
    const channel = client.channel('admin-workspace-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, () => { void load() })
      .subscribe(status => { if (status === 'SUBSCRIBED') void load() })
    return () => { void client.removeChannel(channel) }
  }, [])

  const totalViews = useMemo(() => profiles.reduce((sum, profile) => sum + (profile.views || 0), 0), [profiles])

  const openProfileEditor = (profile?: Profile) => {
    setEditingProfile(profile || null)
    setProfileForm(profileToForm(profile))
    setProfileFiles([])
    setProfileVideoFile(null)
    setProfileEditorOpen(true)
  }

  const openEventEditor = (event?: CommunityEvent) => {
    setEditingEvent(event || null)
    setEventForm(eventToForm(event))
    setEventFile(null)
    setEventEditorOpen(true)
  }

  const updateProfileForm = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setProfileForm(current => ({ ...current, [key]: value }))
  const updateEventForm = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setEventForm(current => ({ ...current, [key]: value }))

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (profileForm.is_published && !profileForm.consent_confirmed) {
      notify('Confirm consent before publishing this profile.')
      return
    }

    const normalizedFacebook = facebookUrl(profileForm.facebook)
    if (profileForm.facebook.trim() && !normalizedFacebook) {
      notify('Enter a valid Facebook profile or page URL.')
      return
    }

    const upload = await uploadImages('profile-images', 'profiles', profileFiles.slice(0, 12))
    if (upload.error) {
      notify(upload.error)
      return
    }

    const gallery = unique([...profileForm.gallery_urls, ...upload.urls]).slice(0, 20)
    const imageUrl = profileForm.profile_image_url || gallery[0] || ''
    let videoUrl = profileForm.video_url.trim()
    if (profileVideoFile) {
      const videoUpload = await uploadImages('profile-images', 'profile-videos', [profileVideoFile])
      if (videoUpload.error) {
        notify(videoUpload.error)
        return
      }
      videoUrl = videoUpload.urls[0] || videoUrl
    }
    const payload = {
      display_name: profileForm.display_name.trim(),
      nickname: optional(profileForm.nickname),
      short_description: profileForm.short_description.trim(),
      bio: profileForm.bio.trim(),
      location: optional(profileForm.location) || 'Sapangan',
      profile_image_url: imageUrl,
      video_url: videoUrl || null,
      gallery_urls: gallery,
      hobbies: splitList(profileForm.hobbies),
      interests: splitList(profileForm.interests),
      favorite_sport: optional(profileForm.favorite_sport),
      favorite_music: optional(profileForm.favorite_music),
      fun_facts: splitList(profileForm.fun_facts),
      social_links: normalizedFacebook ? { facebook: normalizedFacebook } : {},
      featured: profileForm.featured,
      is_published: profileForm.is_published,
      consent_confirmed: profileForm.consent_confirmed,
      updated_at: new Date().toISOString(),
    }

    const result = editingProfile
      ? await supabase.from('profiles').update(payload).eq('id', editingProfile.id)
      : await supabase.from('profiles').insert(payload)

    if (result.error) {
      notify(result.error.message)
      return
    }

    notify('Profile saved.')
    setProfileEditorOpen(false)
    setEditingProfile(null)
    setProfileForm(profileToForm())
    setProfileFiles([])
    setProfileVideoFile(null)
    await load()
  }

  const saveEvent = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    let imageUrl = eventForm.image_url
    if (eventFile) {
      const upload = await uploadImages('event-images', 'events', [eventFile])
      if (upload.error) {
        notify(upload.error)
        return
      }
      imageUrl = upload.urls[0] || imageUrl
    }

    const payload = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      date: eventForm.date,
      time: optional(eventForm.time),
      location: optional(eventForm.location),
      image_url: imageUrl,
      is_published: eventForm.is_published,
      updated_at: new Date().toISOString(),
    }

    const result = editingEvent
      ? await supabase.from('events').update(payload).eq('id', editingEvent.id)
      : await supabase.from('events').insert(payload)

    if (result.error) {
      notify(result.error.message)
      return
    }

    notify('Event saved.')
    setEventEditorOpen(false)
    setEditingEvent(null)
    setEventForm(eventToForm())
    setEventFile(null)
    await load()
  }

  const togglePublished = async (profile: Profile) => {
    if (!supabase) return
    if (!profile.is_published && !profile.consent_confirmed) {
      notify('Confirm consent before publishing this profile.')
      return
    }
    const result = await supabase.from('profiles').update({ is_published: !profile.is_published, updated_at: new Date().toISOString() }).eq('id', profile.id)
    notify(result.error?.message || (profile.is_published ? 'Profile hidden.' : 'Profile published.'))
    await load()
  }

  const toggleFeatured = async (profile: Profile) => {
    if (!supabase) return
    const result = await supabase.from('profiles').update({ featured: !profile.featured, updated_at: new Date().toISOString() }).eq('id', profile.id)
    notify(result.error?.message || (profile.featured ? 'Profile unfeatured.' : 'Profile featured.'))
    await load()
  }

  const requestProfileDelete = (profile: Profile) => {
    setConfirm({
      title: 'Are you sure you want to delete this profile?',
      body: `${profile.display_name} will be hidden from public visitors. The data stays in Supabase so it can be reviewed later.`,
      actionLabel: 'Delete',
      danger: true,
      run: async () => {
        if (!supabase) return
        const result = await supabase.from('profiles').update({ is_published: false, featured: false, updated_at: new Date().toISOString() }).eq('id', profile.id)
        notify(result.error?.message || 'Profile hidden and preserved.')
        await load()
      },
    })
  }

  const requestEventDelete = (event: CommunityEvent) => {
    setConfirm({
      title: 'Delete this event?',
      body: `${event.title} will be removed from the events list.`,
      actionLabel: 'Delete',
      danger: true,
      run: async () => {
        if (!supabase) return
        const result = await supabase.from('events').delete().eq('id', event.id)
        notify(result.error?.message || 'Event deleted.')
        await load()
      },
    })
  }

  const toggleEventPublished = async (event: CommunityEvent) => {
    if (!supabase) return
    const result = await supabase.from('events').update({ is_published: !event.is_published, updated_at: new Date().toISOString() }).eq('id', event.id)
    notify(result.error?.message || (event.is_published ? 'Event unpublished.' : 'Event published.'))
    await load()
  }

  const saveContent = async () => {
    if (!supabase) return
    const rows = Object.entries(content).map(([key, value]) => ({ key, value }))
    const result = await supabase.from('site_content').upsert(rows, { onConflict: 'key' })
    notify(result.error?.message || 'Website content saved.')
    await load()
  }

  const removeGalleryUrl = (url: string) => {
    setProfileForm(current => {
      const nextGallery = current.gallery_urls.filter(item => item !== url)
      return { ...current, gallery_urls: nextGallery, profile_image_url: current.profile_image_url === url ? nextGallery[0] || '' : current.profile_image_url }
    })
  }

  const moveGalleryUrl = (index: number, direction: number) => {
    setProfileForm(current => {
      const gallery = [...current.gallery_urls]
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= gallery.length) return current
      const [item] = gallery.splice(index, 1)
      gallery.splice(nextIndex, 0, item)
      return { ...current, gallery_urls: gallery }
    })
  }

  return <div className="admin-content">
    {message && <div className="toast">{message}</div>}
    <ConsentNotice />
    {section === 'dashboard' && <DashboardPanel profiles={profiles} events={events} totalViews={totalViews} loading={loading} onAddProfile={() => openProfileEditor()} onAddEvent={() => openEventEditor()} />}
    {section === 'boys' && <BoysPanel profiles={profiles} loading={loading} onAdd={() => openProfileEditor()} onEdit={openProfileEditor} onDelete={requestProfileDelete} onTogglePublished={togglePublished} onToggleFeatured={toggleFeatured} />}
    {section === 'events' && <EventsPanel events={events} loading={loading} onAdd={() => openEventEditor()} onEdit={openEventEditor} onDelete={requestEventDelete} onTogglePublished={toggleEventPublished} />}
    {section === 'settings' && <SettingsPanel content={content} setContent={setContent} onSave={saveContent} />}

    {profileEditorOpen && <div className="modal-backdrop">
      <form className="workspace-modal wide-modal" onSubmit={saveProfile}>
        <button type="button" className="modal-close" onClick={() => setProfileEditorOpen(false)}><X size={17} /></button>
        <span className="eyebrow">{editingProfile ? 'Edit boy' : 'Add boy'}</span>
        <h2>{editingProfile ? editingProfile.display_name : 'New profile'}</h2>
        <div className="modal-grid">
          <label>Name<input required value={profileForm.display_name} onChange={event => updateProfileForm('display_name', event.target.value)} /></label>
          <label>Nickname<input value={profileForm.nickname} onChange={event => updateProfileForm('nickname', event.target.value)} /></label>
          <label>General location<input value={profileForm.location} onChange={event => updateProfileForm('location', event.target.value)} /></label>
          <label>Facebook link<input type="url" placeholder="https://facebook.com/username" value={profileForm.facebook} onChange={event => updateProfileForm('facebook', event.target.value)} /></label>
          <label className="span-2">Short description<textarea required value={profileForm.short_description} onChange={event => updateProfileForm('short_description', event.target.value)} /></label>
          <label className="span-2">Biography<textarea value={profileForm.bio} onChange={event => updateProfileForm('bio', event.target.value)} /></label>
          <label>Hobbies<input placeholder="Basketball, music" value={profileForm.hobbies} onChange={event => updateProfileForm('hobbies', event.target.value)} /></label>
          <label>Interests<input placeholder="Gaming, sports, art" value={profileForm.interests} onChange={event => updateProfileForm('interests', event.target.value)} /></label>
          <label>Favorite sport<input value={profileForm.favorite_sport} onChange={event => updateProfileForm('favorite_sport', event.target.value)} /></label>
          <label>Favorite music<input value={profileForm.favorite_music} onChange={event => updateProfileForm('favorite_music', event.target.value)} /></label>
          <label className="span-2">Fun facts<input placeholder="Comma-separated facts" value={profileForm.fun_facts} onChange={event => updateProfileForm('fun_facts', event.target.value)} /></label>
          <label>Primary image URL<input value={profileForm.profile_image_url} onChange={event => updateProfileForm('profile_image_url', event.target.value)} /></label>
          <label>Profile video URL<input type="url" placeholder="https://.../video.mp4" value={profileForm.video_url} onChange={event => updateProfileForm('video_url', event.target.value)} /></label>
        </div>
        <div className="video-manager"><div className="panel-head compact-head"><div><span className="eyebrow">Profile video</span><h3>Optional introduction</h3></div><label className="upload-inline"><Video size={15} /> Upload video<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => setProfileVideoFile(event.target.files?.[0] || null)} /></label></div>{profileForm.video_url && <video className="admin-video-preview" src={profileForm.video_url} controls preload="metadata" />}{profileVideoFile && <p className="upload-note">{profileVideoFile.name} ready to upload.</p>}<small className="field-help">Use a short, consent-approved introduction video. MP4 or WebM works best.</small></div>
        <div className="gallery-manager">
          <div className="panel-head compact-head"><div><span className="eyebrow">Photo gallery</span><h3>Public images</h3></div><label className="upload-inline"><Upload size={15} /> Upload<input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={event => setProfileFiles(Array.from(event.target.files || []))} /></label></div>
          <div className="admin-gallery-list">
            {unique([profileForm.profile_image_url, ...profileForm.gallery_urls]).map((url, index) => <div className="admin-gallery-item" key={url}>
              <AdminImage src={url} name={profileForm.display_name} />
              <span>{profileForm.profile_image_url === url ? 'Primary photo' : `Gallery ${index + 1}`}</span>
              <div>
                <button type="button" className="icon-button" title="Set primary" onClick={() => updateProfileForm('profile_image_url', url)}><Check size={14} /></button>
                <button type="button" className="icon-button" title="Move up" onClick={() => moveGalleryUrl(index, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="icon-button" title="Move down" onClick={() => moveGalleryUrl(index, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="icon-button danger" title="Remove from gallery" onClick={() => removeGalleryUrl(url)}><Trash2 size={14} /></button>
              </div>
            </div>)}
            {!profileForm.profile_image_url && !profileForm.gallery_urls.length && !profileFiles.length && <div className="empty compact"><ImagePlus size={24} /><p>No photos selected.</p></div>}
            {profileFiles.length > 0 && <p className="upload-note">{profileFiles.length} new image{profileFiles.length === 1 ? '' : 's'} ready to upload.</p>}
          </div>
        </div>
        <div className="switch-row">
          <label className="consent"><input type="checkbox" checked={profileForm.consent_confirmed} onChange={event => updateProfileForm('consent_confirmed', event.target.checked)} /><span><b>Permission confirmed</b><small>Profile details and photos are approved for publication.</small></span></label>
          <label className="consent"><input type="checkbox" checked={profileForm.is_published} onChange={event => updateProfileForm('is_published', event.target.checked)} /><span><b>Published</b><small>Visible on the public website.</small></span></label>
          <label className="consent"><input type="checkbox" checked={profileForm.featured} onChange={event => updateProfileForm('featured', event.target.checked)} /><span><b>Featured</b><small>Show near the top of the homepage.</small></span></label>
        </div>
        <button className="button button-dark" disabled={profileForm.is_published && !profileForm.consent_confirmed}><Save size={15} /> Save profile</button>
      </form>
    </div>}

    {eventEditorOpen && <div className="modal-backdrop">
      <form className="workspace-modal" onSubmit={saveEvent}>
        <button type="button" className="modal-close" onClick={() => setEventEditorOpen(false)}><X size={17} /></button>
        <span className="eyebrow">{editingEvent ? 'Edit event' : 'Add event'}</span>
        <h2>{editingEvent ? editingEvent.title : 'Community event'}</h2>
        <label>Title<input required value={eventForm.title} onChange={event => updateEventForm('title', event.target.value)} /></label>
        <label>Description<textarea value={eventForm.description} onChange={event => updateEventForm('description', event.target.value)} /></label>
        <div className="modal-grid">
          <label>Date<input required type="date" value={eventForm.date} onChange={event => updateEventForm('date', event.target.value)} /></label>
          <label>Time<input value={eventForm.time} onChange={event => updateEventForm('time', event.target.value)} /></label>
          <label className="span-2">General location<input value={eventForm.location} onChange={event => updateEventForm('location', event.target.value)} /></label>
        </div>
        <label>Event image URL<input value={eventForm.image_url} onChange={event => updateEventForm('image_url', event.target.value)} /></label>
        <label className="upload-inline"><Upload size={15} /> Upload event image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setEventFile(event.target.files?.[0] || null)} /></label>
        <label className="consent"><input type="checkbox" checked={eventForm.is_published} onChange={event => updateEventForm('is_published', event.target.checked)} /><span><b>Published</b><small>Visible on the public events page.</small></span></label>
        <button className="button button-dark"><Save size={15} /> Save event</button>
      </form>
    </div>}

    {confirm && <div className="modal-backdrop">
      <div className="confirm-dialog">
        <span className="eyebrow">Confirm action</span>
        <h2>{confirm.title}</h2>
        <p>{confirm.body}</p>
        <div className="confirm-actions">
          <button className="button button-outline" onClick={() => setConfirm(null)}>Cancel</button>
          <button className={confirm.danger ? 'button button-danger' : 'button button-dark'} onClick={async () => { const run = confirm.run; setConfirm(null); await run() }}>{confirm.actionLabel}</button>
        </div>
      </div>
    </div>}
  </div>
}

function ConsentNotice() {
  return <div className="consent-notice"><ShieldCheck size={18} /><span>Verify consent before publishing any profile, photo, Facebook link, or event image.</span></div>
}

function DashboardPanel({ profiles, events, totalViews, loading, onAddProfile, onAddEvent }: { profiles: Profile[]; events: CommunityEvent[]; totalViews: number; loading: boolean; onAddProfile: () => void; onAddEvent: () => void }) {
  return <>
    <div className="admin-title"><div><span className="eyebrow">Dashboard</span><h1>Community overview.</h1></div><div className="button-row"><button className="button button-outline" onClick={onAddEvent}><CalendarDays size={16} /> Add event</button><button className="button button-dark" onClick={onAddProfile}><Plus size={16} /> Add boy</button></div></div>
    <div className="stats">
      <div><span><Users size={17} /> Total boys</span><b>{loading ? '-' : profiles.length}</b><small>Managed profiles</small></div>
      <div><span><Eye size={17} /> Published</span><b>{profiles.filter(profile => profile.is_published).length}</b><small>Visible publicly</small></div>
      <div><span><Star size={17} /> Featured</span><b>{profiles.filter(profile => profile.featured).length}</b><small>Homepage highlights</small></div>
      <div><span><BarChart3 size={17} /> Views</span><b>{totalViews}</b><small>Public profile opens</small></div>
    </div>
    <div className="workspace-two">
      <div className="admin-panel workspace-panel"><div className="panel-head"><div><span className="eyebrow">Latest boys</span><h2>Recent profiles</h2></div><Link className="text-link" to="/admin/boys">Manage <ArrowUpRight size={15} /></Link></div><ProfileRows profiles={profiles.slice(0, 4)} /></div>
      <div className="admin-panel workspace-panel"><div className="panel-head"><div><span className="eyebrow">Events</span><h2>Upcoming posts</h2></div><Link className="text-link" to="/admin/events">Manage <ArrowUpRight size={15} /></Link></div><EventRows events={events.slice(0, 4)} /></div>
    </div>
  </>
}

function BoysPanel({ profiles, loading, onAdd, onEdit, onDelete, onTogglePublished, onToggleFeatured }: { profiles: Profile[]; loading: boolean; onAdd: () => void; onEdit: (profile: Profile) => void; onDelete: (profile: Profile) => void; onTogglePublished: (profile: Profile) => Promise<void>; onToggleFeatured: (profile: Profile) => Promise<void> }) {
  return <>
    <div className="admin-title"><div><span className="eyebrow">Boys</span><h1>Profiles.</h1></div><button className="button button-dark" onClick={onAdd}><Plus size={16} /> Add boy</button></div>
    <div className="admin-panel workspace-panel">
      <div className="panel-head"><div><span className="eyebrow">Directory profiles</span><h2>Add, edit, hide, feature.</h2></div></div>
      {loading ? <div className="empty compact"><p>Loading profiles...</p></div> : profiles.length ? <div className="workspace-list">{profiles.map(profile => <div className="workspace-row profile-admin-row" key={profile.id}>
        <div className="table-profile"><AdminImage src={profile.profile_image_url || profileImages(profile)[0]} name={profile.display_name} /><div><b>{profile.display_name}</b><small>{profile.nickname || profile.location || 'Sapangan'}</small></div></div>
        <StatusPill published={profile.is_published} />
        <span className={profile.featured ? 'featured-status' : 'muted-status'}>{profile.featured ? 'Featured' : 'Standard'}</span>
        <span className="muted-status">{profile.views || 0} views</span>
        <div className="workspace-actions">
          <button className="icon-button" title="View public profile" onClick={() => window.open(`/profile/${profile.id}`, '_blank')}><Eye size={15} /></button>
          <button className="icon-button" title={profile.is_published ? 'Hide profile' : 'Publish profile'} onClick={() => void onTogglePublished(profile)}>{profile.is_published ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          <button className="icon-button" title={profile.featured ? 'Remove featured' : 'Feature profile'} onClick={() => void onToggleFeatured(profile)}><Star size={15} /></button>
          <button className="icon-button" title="Edit" onClick={() => onEdit(profile)}><Edit3 size={15} /></button>
          <button className="icon-button danger" title="Delete" onClick={() => onDelete(profile)}><Trash2 size={15} /></button>
        </div>
      </div>)}</div> : <div className="empty"><Users size={28} /><h3>No profiles yet.</h3><p>Add the first boy when consent is confirmed.</p></div>}
    </div>
  </>
}

function EventsPanel({ events, loading, onAdd, onEdit, onDelete, onTogglePublished }: { events: CommunityEvent[]; loading: boolean; onAdd: () => void; onEdit: (event: CommunityEvent) => void; onDelete: (event: CommunityEvent) => void; onTogglePublished: (event: CommunityEvent) => Promise<void> }) {
  return <>
    <div className="admin-title"><div><span className="eyebrow">Events</span><h1>Community events.</h1></div><button className="button button-dark" onClick={onAdd}><Plus size={16} /> Add event</button></div>
    <div className="admin-panel workspace-panel">
      <div className="panel-head"><div><span className="eyebrow">Calendar</span><h2>Publish upcoming activities.</h2></div></div>
      {loading ? <div className="empty compact"><p>Loading events...</p></div> : events.length ? <div className="workspace-list">{events.map(event => <div className="workspace-row event-admin-row" key={event.id}>
        <div><b>{event.title}</b><small>{event.date}{event.location ? ` - ${event.location}` : ''}</small></div>
        <StatusPill published={event.is_published} />
        <div className="workspace-actions">
          <button className="icon-button" title={event.is_published ? 'Unpublish event' : 'Publish event'} onClick={() => void onTogglePublished(event)}>{event.is_published ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          <button className="icon-button" title="Edit" onClick={() => onEdit(event)}><Edit3 size={15} /></button>
          <button className="icon-button danger" title="Delete" onClick={() => onDelete(event)}><Trash2 size={15} /></button>
        </div>
      </div>)}</div> : <div className="empty"><CalendarDays size={28} /><h3>No Events</h3><p>No upcoming events at the moment.</p></div>}
    </div>
  </>
}

function SettingsPanel({ content, setContent, onSave }: { content: SiteContent; setContent: React.Dispatch<React.SetStateAction<SiteContent>>; onSave: () => Promise<void> }) {
  return <>
    <div className="admin-title"><div><span className="eyebrow">Settings</span><h1>Website content.</h1></div><button className="button button-dark" onClick={() => void onSave()}><Save size={16} /> Save</button></div>
    <div className="admin-panel workspace-panel">
      <div className="panel-head"><div><span className="eyebrow"><Settings size={12} /> Public text</span><h2>Homepage and information pages.</h2></div></div>
      <div className="content-fields">
        <label>Boys page introduction<textarea value={content.boys_intro} onChange={event => setContent(current => ({ ...current, boys_intro: event.target.value }))} /></label>
        <label>About heading<input value={content.about_heading} onChange={event => setContent(current => ({ ...current, about_heading: event.target.value }))} /></label>
        <label>About page description<textarea value={content.about_body} onChange={event => setContent(current => ({ ...current, about_body: event.target.value }))} /></label>
        <label>Contact email<input value={content.contact_email} onChange={event => setContent(current => ({ ...current, contact_email: event.target.value }))} /></label>
        <label className="span-2">Contact description<textarea value={content.contact_body} onChange={event => setContent(current => ({ ...current, contact_body: event.target.value }))} /></label>
      </div>
    </div>
  </>
}

function ProfileRows({ profiles }: { profiles: Profile[] }) {
  if (!profiles.length) return <div className="empty compact"><p>No profiles yet.</p></div>
  return <div className="mini-list">{profiles.map(profile => <Link to="/admin/boys" key={profile.id}><AdminImage src={profile.profile_image_url} name={profile.display_name} /><span><b>{profile.display_name}</b><small>{profile.is_published ? 'Published' : 'Hidden'}</small></span></Link>)}</div>
}

function EventRows({ events }: { events: CommunityEvent[] }) {
  if (!events.length) return <div className="empty compact"><p>No events yet.</p></div>
  return <div className="mini-list">{events.map(event => <Link to="/admin/events" key={event.id}><CalendarDays size={22} /><span><b>{event.title}</b><small>{event.date}</small></span></Link>)}</div>
}
