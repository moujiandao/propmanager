import { createClient } from '../../../../lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env

const EXTRACT_PROMPT = `You are extracting tenant information from a rental application or lease agreement. Return ONLY valid JSON with no markdown, no explanation, just the JSON object. Use null for any field not found.

IMPORTANT: If there are multiple tenants on the lease, put ONLY the first tenant's name in tenant_name and ALL other tenants in the housemates array as separate entries. Never combine multiple names into one string.

Extract these fields:
{
  "tenant_name": "string - first/primary tenant only, one person",
  "email": "string or null",
  "phone": "string or null",
  "home_address": "string or null",
  "move_in_date": "YYYY-MM-DD or null",
  "move_out_date": "YYYY-MM-DD or null",
  "has_cosigner": true or false,
  "student_status": "undergrad|masters|phd|none or null",
  "student_year": "string e.g. 2nd year or null",
  "current_rent": "number or null",
  "zelle_name": "string or null",
  "age": "number or null",
  "lease_start_date": "YYYY-MM-DD or null",
  "lease_end_date": "YYYY-MM-DD or null",
  "rent_amount": "number or null",
  "housemates": ["string names - all other tenants on the lease besides the primary tenant_name"] or []
}`

export async function POST(request) {
  const supabase = await createClient()
  const { documentId } = await request.json()

  if (!documentId) {
    return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
  }

  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(doc.file_path)

  if (downloadError) {
    return NextResponse.json({ error: downloadError.message }, { status: 500 })
  }

  let message

  const isPdf = doc.file_type === 'application/pdf' || doc.file_name.endsWith('.pdf')
  const isDocx = doc.file_type?.includes('wordprocessingml') || doc.file_name.match(/\.docx?$/)

  try {
    if (isPdf) {
      const buffer = await fileData.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')

      message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 }
            },
            { type: 'text', text: EXTRACT_PROMPT }
          ]
        }]
      })
    } else if (isDocx) {
      const buffer = await fileData.arrayBuffer()
      const { value: text } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })

      message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `${EXTRACT_PROMPT}\n\nDocument text:\n${text}`
        }]
      })
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Upload PDF or DOCX.' }, { status: 400 })
    }
  } catch (apiError) {
    console.error('Claude API error:', apiError)
    return NextResponse.json({ error: `AI parsing failed: ${apiError.message}` }, { status: 500 })
  }

  let extracted
  try {
    let raw = message.content[0].text.trim()
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) raw = fenceMatch[1].trim()
    extracted = JSON.parse(raw)
  } catch {
    console.error('AI returned invalid JSON:', message.content[0].text)
    return NextResponse.json({ error: 'AI returned invalid JSON', raw: message.content[0].text }, { status: 500 })
  }

  // Safety net: if tenant_name contains multiple names (comma-separated), split them
  if (extracted.tenant_name && extracted.tenant_name.includes(',')) {
    const names = extracted.tenant_name.split(',').map(n => n.trim()).filter(Boolean)
    extracted.tenant_name = names[0]
    extracted.housemates = [...names.slice(1), ...(extracted.housemates || [])]
  }

  const { error: updateError } = await supabase
    .from('documents')
    .update({ ai_extracted: extracted })
    .eq('id', documentId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ extracted })
}
