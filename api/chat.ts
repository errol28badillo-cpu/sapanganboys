type ChatMessage = { role: 'user' | 'model'; text: string }

type RequestBody = { messages?: ChatMessage[] }

type VercelRequest = { method?: string; body?: RequestBody }
type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const siteContext = `You are the Sapangan Boys community assistant. Answer questions using only this website context:
- Sapangan Boys is a public community profile directory for Sapangan, San Juan, Batangas.
- Visitors can browse public profiles, interests, hobbies, community events, ratings, and feedback.
- Visitors can use the search and interest filters, open a profile gallery, leave a 1-5 star rating, and write feedback using a generated username.
- Public profiles use voluntarily provided information and general locations. Visitors can request corrections or removal through the Contact page.
- The admin workspace manages profiles, events, categories, and site content.
- Do not invent profile facts, events, contact details, or private information. If the website does not contain the answer, say so and point the visitor to the relevant page.
- Reply in the same language as the visitor whenever possible. Keep replies friendly, concise, and easy to scan.`

function localWebsiteReply(question: string) {
  const normalized = question.toLowerCase()
  if (/^(hi|hello|hey|kumusta|kamusta|hola|bonjour)\b/.test(normalized)) return 'Hello! I can help you explore Sapangan Boys, profiles, interests, events, ratings, feedback, and site navigation.'
  if (/event|activity|กิจกรรม|evento|événement/.test(normalized)) return 'Open the Events page to see upcoming community activities published by the admin. If there are no events yet, check back later.'
  if (/rate|rating|star|feedback|review|comment|puna|评价|valoración/.test(normalized)) return 'Open a profile and scroll to Community feedback. You can choose 1 to 5 stars and write a comment using your visitor username.'
  if (/profile|boy|person|member|directory| ಹುಡುಗ|โปรไฟล์|perfil|profil/.test(normalized)) return 'Use Boys to browse public profiles. You can search by name, sort results, filter by interest, open a profile gallery, and view the available hobbies and interests.'
  if (/interest|hobby|sport|music|gaming|basketball|photography/.test(normalized)) return 'Use the Interests section or the interest filters on the Boys page to find profiles by hobbies and interests.'
  if (/contact|correction|remove|privacy|admin/.test(normalized)) return 'Use the Contact page to request a correction or profile removal. Public profiles contain voluntarily provided information and general locations.'
  if (/install|app|phone|mobile/.test(normalized)) return 'This website can be installed as an app on supported browsers. Choose Install when the install notice appears, or use your browser menu and choose Add to Home Screen.'
  return 'I can help with Sapangan Boys profiles, interests, hobbies, community events, ratings, feedback, privacy, contact requests, and using the website. Which one would you like to know about?'
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST for chat messages.' })
  const messages = (request.body?.messages || []).slice(-12).filter(item => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string')
  if (!messages.length) return response.status(400).json({ error: 'Please enter a question.' })

  const apiKey = process.env.GEMINI_API_KEY
  const latestQuestion = messages[messages.length - 1].text
  if (!apiKey) return response.status(200).json({ reply: localWebsiteReply(latestQuestion), mode: 'website-guide' })

  const contents = messages.map(item => ({ role: item.role, parts: [{ text: item.text.slice(0, 2000) }] }))
  const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: siteContext }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 500 } }),
  })

  if (!result.ok) return response.status(200).json({ reply: localWebsiteReply(latestQuestion), mode: 'website-guide' })
  const data = await result.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim()
  return response.status(200).json({ reply: reply || 'I could not find an answer for that on this website.' })
}
