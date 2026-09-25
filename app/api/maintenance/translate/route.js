import Anthropic from '@anthropic-ai/sdk'
import { requireSignedIn } from '@/lib/auth/authorize'

const client = new Anthropic()

export async function POST(request) {
  const { text } = await request.json()
  const auth = await requireSignedIn()
  if (auth.response) return auth.response
  if (!text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Translate the following maintenance request text into natural, vernacular Mandarin Chinese as it would be spoken or written by a native speaker in mainland China. Do not translate literally — capture the meaning and intent authentically, using natural phrasing a Chinese-speaking landlord or property manager would actually use.

Important: Keep all personal names (such as tenant names) exactly as written in the original English/Latin script. Do not translate or transliterate names into Chinese characters.

Return only the translated text, nothing else.

Text to translate:
${text}`,
        },
      ],
    })

    const translation = message.content[0]?.text || ''
    return Response.json({ translation })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
