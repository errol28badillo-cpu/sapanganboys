export type SocialLinks = { facebook?: string; instagram?: string; tiktok?: string }

export type Profile = {
  id: string
  display_name: string
  nickname?: string | null
  short_description: string
  bio: string
  profile_image_url: string
  video_url?: string | null
  gallery_urls?: string[] | null
  location?: string | null
  hobbies: string[]
  interests: string[]
  favorite_sport?: string | null
  favorite_music?: string | null
  fun_facts?: string[] | null
  category_id?: string | null
  category?: string
  social_links?: SocialLinks
  featured?: boolean
  views?: number
  is_published: boolean
  consent_confirmed: boolean
  archived_at?: string | null
  created_at: string
  updated_at: string
}

export type Category = { id: string; name: string; description?: string; created_at: string }

export type CommunityEvent = {
  id: string
  title: string
  description: string
  date: string
  time?: string
  location?: string
  image_url?: string
  is_published: boolean
  created_at: string
  updated_at?: string
}

export type ProfileFeedback = {
  id: string
  profile_id: string
  username: string
  gender: 'male' | 'female'
  rating: number
  message: string
  created_at: string
}

export type SiteContent = {
  boys_intro: string
  about_heading: string
  about_body: string
  contact_email: string
  contact_body: string
}
