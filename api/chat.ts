type ChatMessage = { role: 'user' | 'model'; text: string }

type RequestBody = { messages?: ChatMessage[] }

type VercelRequest = { method?: string; body?: RequestBody }
type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

type PublicProfile = { id: string; display_name: string; nickname?: string | null }
type FeedbackRow = { profile_id: string; rating: number }

const siteContext = `You are the Sapangan Boys community assistant. Answer questions using only this website context:
- Sapangan Boys is a public community profile directory for Sapangan, San Juan, Batangas.
- Visitors can browse public profiles, interests, hobbies, community events, ratings, and feedback.
- Visitors can use the search and interest filters, open a profile gallery, leave a 1-5 star rating, and write feedback using a generated username.
- Public profiles use voluntarily provided information and general locations. Visitors can request corrections or removal through the Contact page.
- The admin workspace manages profiles, events, categories, and site content.
- Do not invent profile facts, events, contact details, or private information. If the website does not contain the answer, say so and point the visitor to the relevant page.
- Reply in the same language as the visitor whenever possible. Keep replies friendly, concise, and easy to scan.`

async function getRatingContext() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return [] as Array<{ name: string; average: number; count: number }>
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const [profilesResult, feedbackResult] = await Promise.all([
    fetch(`${url}/rest/v1/profiles?select=id,display_name,nickname&is_published=eq.true`, { headers }),
    fetch(`${url}/rest/v1/profile_feedback?select=profile_id,rating&order=created_at.desc`, { headers }),
  ])
  if (!profilesResult.ok || !feedbackResult.ok) return []
  const profiles = await profilesResult.json() as PublicProfile[]
  const feedback = await feedbackResult.json() as FeedbackRow[]
  return profiles.map(profile => {
    const ratings = feedback.filter(item => item.profile_id === profile.id).map(item => item.rating)
    return { name: profile.nickname || profile.display_name, average: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0, count: ratings.length }
  }).filter(item => item.count > 0).sort((a, b) => b.average - a.average || b.count - a.count)
}

function localWebsiteReply(question: string, ratings: Array<{ name: string; average: number; count: number }>) {
  const normalized = question.toLowerCase()
  const tagalog = /\b(ano|sino|mga|ang|ng|sa|ito|iyon|paano|may|wala|maganda|gwapo|pangit|salamat|kumusta|kamusta)\b/.test(normalized)
  const rankedQuestion = /handsome|gwapo|pog[iy]|beautiful|attractive|good[- ]?looking|ugly|pangit|best rated|highest rated|pinaka|rating|popular/.test(normalized)
  if (/^(hi|hello|hey|kumusta|kamusta|hola|bonjour)\b/.test(normalized)) return tagalog ? 'Kumusta! Matutulungan kitang maghanap ng profiles, interests, events, ratings, feedback, at impormasyon tungkol sa website.' : 'Hello! I can help you explore profiles, interests, events, ratings, feedback, and site navigation.'
  if (rankedQuestion) {
    if (!ratings.length) return tagalog ? 'Wala pang sapat na rating sa mga profile para makapili ng highest-rated. Maaari kang mag-rate sa profile page.' : 'There are not enough ratings yet to identify a highest-rated profile. You can rate someone on their profile page.'
    const top = ratings.slice(0, 3).map(item => `${item.name} (${item.average.toFixed(1)}/5, ${item.count} rating${item.count === 1 ? '' : 's'})`).join(', ')
    return tagalog ? `Batay sa ratings ng community, ang pinakamataas sa ngayon ay: ${top}. Hindi ako maglalagay ng mapanlait na label tulad ng "pangit"; ang ratings ay opinion lamang at hindi sukatan ng halaga ng tao.` : `Based on community ratings, the highest-rated profiles right now are: ${top}. I will not label anyone as “ugly”; ratings are subjective opinions, not a measure of a person's worth.`
  }
  if (/event|activity|กิจกรรม|evento|événement/.test(normalized)) return tagalog ? 'Buksan ang Events page para makita ang mga community activity na inilathala ng admin.' : 'Open the Events page to see upcoming community activities published by the admin.'
  if (/rate|rating|star|feedback|review|comment|puna|评价|valoración/.test(normalized)) return tagalog ? 'Buksan ang profile at pumunta sa Community feedback. Pumili ng 1 hanggang 5 stars at magsulat ng komento.' : 'Open a profile and scroll to Community feedback. You can choose 1 to 5 stars and write a comment.'
  if (/profile|boy|person|member|directory| ಹುಡುಗ|โปรไฟล์|perfil|profil/.test(normalized)) return tagalog ? 'Gamitin ang Boys page para maghanap ng profiles, mag-filter ayon sa interest, at makita ang hobbies at gallery.' : 'Use Boys to browse profiles, search by name, filter by interest, and view hobbies and galleries.'
  if (/interest|hobby|sport|music|gaming|basketball|photography/.test(normalized)) return tagalog ? 'Gamitin ang Interests section o filters sa Boys page para maghanap ayon sa hobbies at interests.' : 'Use the Interests section or filters on the Boys page to find profiles by hobbies and interests.'
  if (/contact|correction|remove|privacy|admin/.test(normalized)) return tagalog ? 'Gamitin ang Contact page para humiling ng correction o pagtanggal ng profile. Ang public profiles ay may kusang-loob na impormasyon.' : 'Use the Contact page to request a correction or profile removal. Public profiles use voluntarily provided information.'
  if (/install|app|phone|mobile/.test(normalized)) return tagalog ? 'Maaaring i-install ang website bilang app sa supported browser. Piliin ang Install o Add to Home Screen sa browser menu.' : 'This website can be installed as an app on supported browsers. Choose Install or Add to Home Screen in your browser menu.'
  return tagalog ? 'Matutulungan kita sa profiles, interests, events, ratings, feedback, privacy, contact, at paggamit ng website. Ano ang gusto mong malaman?' : 'I can help with profiles, interests, events, ratings, feedback, privacy, contact, and using the website. What would you like to know?'
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST for chat messages.' })
  const messages = (request.body?.messages || []).slice(-12).filter(item => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string')
  if (!messages.length) return response.status(400).json({ error: 'Please enter a question.' })

  const latestQuestion = messages[messages.length - 1].text
  const ratings = await getRatingContext().catch(() => [])
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return response.status(200).json({ reply: localWebsiteReply(latestQuestion, ratings), mode: 'website-guide' })

  const contents = messages.map(item => ({ role: item.role, parts: [{ text: item.text.slice(0, 2000) }] }))
  const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: `${siteContext}\nCurrent published profile rating context: ${JSON.stringify(ratings)}\nFor questions about handsome, beautiful, ugly, popular, or best-rated profiles, use this rating context, say ratings are subjective, never insult a person, and reply in the user's language.` }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 500 } }),
  })

  if (!result.ok) return response.status(200).json({ reply: localWebsiteReply(latestQuestion, ratings), mode: 'website-guide' })
  const data = await result.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim()
  return response.status(200).json({ reply: reply || 'I could not find an answer for that on this website.' })
}
