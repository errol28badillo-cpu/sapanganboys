import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const defaultSiteContent = {
  boys_intro: 'Browse the faces, interests, and stories of our community.',
  about_heading: 'Small place. Big character.',
  about_body: 'Sapangan Boys is a community profile website created to showcase the personalities, interests, hobbies, and activities of consenting members of Sapangan, San Juan, Batangas.',
  contact_email: 'hello@sapanganboys.ph',
  contact_body: 'Want to suggest a profile, correct a detail, or request removal? Reach out and we will take care of it.',
}

export function useSiteContent() {
  const [content, setContent] = useState(defaultSiteContent)
  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    const load = async () => {
      const { data } = await client.from('site_content').select('key,value')
      if (active && data) setContent(current => ({ ...current, ...Object.fromEntries(data.map(row => [row.key, row.value])) }))
    }
    void load()
    const channel = client.channel('public-site-content-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, () => { void load() })
      .subscribe(status => { if (status === 'SUBSCRIBED') void load() })
    return () => { active = false; void client.removeChannel(channel) }
  }, [])
  return content
}
