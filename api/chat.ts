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

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST for chat messages.' })
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return response.status(503).json({ error: 'The assistant is not configured yet. Please try again later.' })

  const messages = (request.body?.messages || []).slice(-12).filter(item => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string')
  if (!messages.length) return response.status(400).json({ error: 'Please enter a question.' })

  const contents = messages.map(item => ({ role: item.role, parts: [{ text: item.text.slice(0, 2000) }] }))
  const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: siteContext }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 500 } }),
  })

  if (!result.ok) return response.status(502).json({ error: 'The assistant could not reach Gemini right now.' })
  const data = await result.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim()
  return response.status(200).json({ reply: reply || 'I could not find an answer for that on this website.' })
}
