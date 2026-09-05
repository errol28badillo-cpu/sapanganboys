export type SocialLinks = { facebook?: string; instagram?: string; tiktok?: string }

export type Profile = {
  id: string
  display_name: string
  short_description: string
  bio: string
  profile_image_url: string
  hobbies: string[]
  interests: string[]
  category_id?: string
  category?: string
  social_links?: SocialLinks
  is_published: boolean
  consent_confirmed: boolean
  created_at: string
  updated_at: string
}

export type Category = { id: string; name: string; description?: string; created_at: string }
