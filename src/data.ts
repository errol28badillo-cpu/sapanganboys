import type { Category, Profile } from './types'

export const categories: Category[] = [
  { id: 'sports', name: 'Sports & Movement', description: 'People who keep the community moving.', created_at: '2024-01-01' },
  { id: 'creative', name: 'Creative Souls', description: 'Artists, makers, and storytellers.', created_at: '2024-01-01' },
  { id: 'music', name: 'Music & Culture', description: 'The sounds and rhythms of Sapangan.', created_at: '2024-01-01' },
]

export const profiles: Profile[] = [
  { id: 'placeholder-01', display_name: 'Your first profile', short_description: 'A placeholder for the first community profile.', bio: 'This is placeholder content. An admin can replace it with a consenting community member profile.', profile_image_url: 'https://ui-avatars.com/api/?name=First+Profile&background=d7e5db&color=183d34&size=900', hobbies: ['Add hobbies'], interests: ['Add interests'], category_id: 'sports', category: 'Sports & Movement', is_published: true, consent_confirmed: true, created_at: '2024-05-18', updated_at: '2024-05-18' },
  { id: 'placeholder-02', display_name: 'Your next profile', short_description: 'A placeholder waiting for an admin to add someone new.', bio: 'This is placeholder content. Replace it from the admin workspace when a profile is ready to publish.', profile_image_url: 'https://ui-avatars.com/api/?name=Next+Profile&background=e5efcf&color=183d34&size=900', hobbies: ['Add hobbies'], interests: ['Add interests'], category_id: 'creative', category: 'Creative Souls', is_published: true, consent_confirmed: true, created_at: '2024-05-11', updated_at: '2024-05-11' },
]
