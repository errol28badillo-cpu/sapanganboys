import { useEffect, useState } from 'react'
import { Edit3, Eye, EyeOff, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Profile } from './types'

type SiteContent = { key: string; value: string }
type ProfileForm = {
  display_name: string
  short_description: string
  bio: string
  hobbies: string
  interests: string
  facebook: string
  profile_image_url: string
  gallery_urls: string[]
  is_published: boolean
  consent_confirmed: boolean
}

const emptyProfile: ProfileForm = { display_name: '', short_description: '', bio: '', hobbies: '', interests: '', facebook: '', profile_image_url: '', gallery_urls: [], is_published: false, consent_confirmed: false }

export default function AdminWorkspace() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [content, setContent] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Profile | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState<ProfileForm>(emptyProfile)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!supabase) return
    const [{ data: profileRows }, { data: contentRows }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('site_content').select('key,value'),
    ])
    setProfiles((profileRows || []) as Profile[])
    setContent(Object.fromEntries(((contentRows || []) as SiteContent[]).map(row => [row.key, row.value])))
  }

  useEffect(() => {
    void load()
    const client = supabase
    if (!client) return
    const channel = client.channel('admin-workspace-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, () => { void load() })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [])

  const editProfile = (profile?: Profile) => {
    setEditorOpen(true)
    setEditing(profile || null)
    setForm(profile ? { display_name: profile.display_name, short_description: profile.short_description, bio: profile.bio, hobbies: profile.hobbies.join(', '), interests: profile.interests.join(', '), facebook: profile.social_links?.facebook || '', profile_image_url: profile.profile_image_url, gallery_urls: profile.gallery_urls || [], is_published: profile.is_published, consent_confirmed: profile.consent_confirmed } : emptyProfile)
    setImageFiles([])
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    let imageUrl = form.profile_image_url
    const galleryUrls = [...form.gallery_urls]
    for (const image of imageFiles.slice(0, Math.max(0, 10 - galleryUrls.length))) {
      const path = `${crypto.randomUUID()}-${image.name}`
      const upload = await supabase.storage.from('profile-images').upload(path, image)
      if (upload.error) { setMessage(upload.error.message); return }
      const publicUrl = supabase.storage.from('profile-images').getPublicUrl(path).data.publicUrl
      galleryUrls.push(publicUrl)
      if (!imageUrl) imageUrl = publicUrl
    }
    const payload = { display_name: form.display_name, short_description: form.short_description, bio: form.bio, hobbies: form.hobbies.split(',').map(value => value.trim()).filter(Boolean), interests: form.interests.split(',').map(value => value.trim()).filter(Boolean), social_links: form.facebook.trim() ? { facebook: form.facebook.trim() } : {}, profile_image_url: imageUrl, gallery_urls: galleryUrls.slice(0, 10), is_published: form.is_published, consent_confirmed: form.consent_confirmed }
    const result = editing ? await supabase.from('profiles').update(payload).eq('id', editing.id) : await supabase.from('profiles').insert(payload)
    if (result.error) { setMessage(result.error.message); return }
    setMessage('Profile saved.')
    setEditing(null)
    setEditorOpen(false)
    setForm(emptyProfile)
    await load()
  }

  const deleteProfile = async (id: string) => {
    if (!supabase || !window.confirm('Delete this profile permanently?')) return
    const result = await supabase.from('profiles').delete().eq('id', id)
    setMessage(result.error?.message || 'Profile deleted.')
    await load()
  }

  const togglePublished = async (profile: Profile) => {
    if (!supabase) return
    const result = await supabase.from('profiles').update({ is_published: !profile.is_published, consent_confirmed: profile.consent_confirmed || !profile.is_published }).eq('id', profile.id)
    setMessage(result.error?.message || (profile.is_published ? 'Profile unpublished.' : 'Profile published.'))
    await load()
  }

  const saveContent = async () => {
    if (!supabase) return
    const result = await supabase.from('site_content').upsert(Object.entries(content).map(([key, value]) => ({ key, value })), { onConflict: 'key' })
    setMessage(result.error?.message || 'Website content saved.')
  }

  const setField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => setForm(current => ({ ...current, [key]: value }))

  return <div className="admin-content">
    <div className="admin-title"><div><span className="eyebrow">Website management</span><h1>Add, edit, publish.</h1></div><button className="button button-dark" onClick={() => editProfile()}><Plus size={16} /> Add boy</button></div>
    {message && <div className="admin-message">{message}</div>}
    <div className="admin-panel workspace-panel"><div className="panel-head"><div><span className="eyebrow">Profiles</span><h2>Select and manage boys</h2></div></div><div className="workspace-list">{profiles.length ? profiles.map(profile => <div className="workspace-row" key={profile.id}><div className="table-profile"><img src={profile.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}`} alt="" /><b>{profile.display_name}</b></div><span className={profile.is_published ? 'status' : 'draft-status'}>{profile.is_published ? 'Published' : 'Draft'}</span><div className="workspace-actions"><button className="icon-button" title="View public profile" onClick={() => window.open(`/profile/${profile.id}`, '_blank')}><Eye size={15} /></button><button className="icon-button" title={profile.is_published ? 'Unpublish' : 'Publish'} onClick={() => void togglePublished(profile)}>{profile.is_published ? <EyeOff size={15} /> : <Eye size={15} />}</button><button className="icon-button" title="Edit" onClick={() => editProfile(profile)}><Edit3 size={15} /></button><button className="icon-button danger" title="Delete" onClick={() => void deleteProfile(profile.id)}><Trash2 size={15} /></button></div></div>) : <div className="empty"><p>No profiles yet. Add the first boy above.</p></div>}</div></div>
    <div className="admin-panel workspace-panel"><div className="panel-head"><div><span className="eyebrow">Site text</span><h2>Edit About, Contact, and Boys</h2></div><button className="button button-outline" onClick={() => void saveContent()}><Save size={15} /> Save website text</button></div><div className="content-fields"><label>Boys page introduction<textarea value={content.boys_intro || ''} onChange={event => setContent({ ...content, boys_intro: event.target.value })} /></label><label>About page heading<textarea value={content.about_heading || ''} onChange={event => setContent({ ...content, about_heading: event.target.value })} /></label><label>About page description<textarea value={content.about_body || ''} onChange={event => setContent({ ...content, about_body: event.target.value })} /></label><label>Contact email<input value={content.contact_email || ''} onChange={event => setContent({ ...content, contact_email: event.target.value })} /></label><label>Contact description<textarea value={content.contact_body || ''} onChange={event => setContent({ ...content, contact_body: event.target.value })} /></label></div></div>
    {editorOpen && <div className="modal-backdrop"><form className="workspace-modal" onSubmit={saveProfile}><button type="button" className="modal-close" onClick={() => setEditorOpen(false)}><X size={17} /></button><span className="eyebrow">{editing ? 'Edit profile' : 'Add profile'}</span><h2>{editing ? editing.display_name : 'Add a boy'}</h2><label>Display name<input required value={form.display_name} onChange={event => setField('display_name', event.target.value)} /></label><label>Short description<textarea required value={form.short_description} onChange={event => setField('short_description', event.target.value)} /></label><label>Biography<textarea value={form.bio} onChange={event => setField('bio', event.target.value)} /></label><label>Hobbies<input placeholder="Basketball, music" value={form.hobbies} onChange={event => setField('hobbies', event.target.value)} /></label><label>Interests<input placeholder="Community, travel" value={form.interests} onChange={event => setField('interests', event.target.value)} /></label><label>Facebook profile link<input type="url" placeholder="https://facebook.com/username" value={form.facebook} onChange={event => setField('facebook', event.target.value)} /></label><label className="upload-inline"><Upload size={15} /> Profile images <small>Up to 10 images</small><input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={event => setImageFiles(Array.from(event.target.files || []).slice(0, 10))} /></label><label className="consent"><input type="checkbox" checked={form.consent_confirmed} onChange={event => setField('consent_confirmed', event.target.checked)} /><span><b>Permission confirmed</b><small>Permission was given to publish this profile.</small></span></label><label className="consent"><input type="checkbox" checked={form.is_published} onChange={event => setField('is_published', event.target.checked)} /><span><b>Publish now</b><small>Only publish with confirmed permission.</small></span></label><button className="button button-dark" disabled={form.is_published && !form.consent_confirmed}><Save size={15} /> Save profile</button></form></div>}
  </div>
}
