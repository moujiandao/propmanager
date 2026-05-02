import { GoogleAuth } from 'google-auth-library'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request) {
  const { propertyId, landlordId } = await request.json()

  if (!propertyId || !landlordId) {
    return Response.json({ error: 'propertyId and landlordId are required.' }, { status: 400 })
  }

  // Get property drive_link
  const { data: property } = await supabase
    .from('properties')
    .select('drive_link, address')
    .eq('id', propertyId)
    .single()

  if (!property?.drive_link) {
    return Response.json({ error: 'No Drive folder linked to this property. Add one on the Properties page.' }, { status: 400 })
  }

  const folderMatch = property.drive_link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (!folderMatch) {
    return Response.json({ error: 'The Drive link for this property is not a folder URL.' }, { status: 400 })
  }
  const folderId = folderMatch[1]

  // Authenticate with Google using service account
  let serviceAccountCredentials
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''
    serviceAccountCredentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return Response.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON env var is missing or invalid.' }, { status: 500 })
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: serviceAccountCredentials.client_email,
      private_key: serviceAccountCredentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  let token
  try {
    const client = await auth.getClient()
    const tokenRes = await client.getAccessToken()
    token = tokenRes.token
  } catch (err) {
    return Response.json({ error: `Google authentication failed: ${err.message}` }, { status: 500 })
  }

  // List files in the Drive folder
  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed%3Dfalse&fields=files(id,name,mimeType,webViewLink)&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!driveRes.ok) {
    const errText = await driveRes.text()
    return Response.json({ error: `Drive API error: ${errText}` }, { status: 500 })
  }

  const driveData = await driveRes.json()
  const files = (driveData.files || []).filter(f =>
    f.mimeType === 'application/pdf' ||
    f.mimeType === 'application/vnd.google-apps.document' ||
    f.name?.toLowerCase().endsWith('.pdf')
  )

  if (files.length === 0) {
    return Response.json({ linked: 0, total: 0, unmatched: [], message: 'No PDF files found in the Drive folder.' })
  }

  // Get contracts + tenants for this property
  const [{ data: contracts }, { data: allTenants }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, unit, start_date, end_date, contract_tenants(tenant_id)')
      .eq('property_id', propertyId),
    supabase.from('tenant_profiles').select('id, name, last_name'),
  ])

  if (!contracts?.length) {
    return Response.json({ error: 'No lease records found for this property.' }, { status: 400 })
  }

  // Build a readable description of each contract for Claude
  const contractDescriptions = contracts.map(c => {
    const tenantNames = (c.contract_tenants || []).map(ct => {
      const t = allTenants?.find(t => t.id === ct.tenant_id)
      return t ? `${t.name || ''} ${t.last_name || ''}`.trim() : ''
    }).filter(Boolean)
    return { id: c.id, unit: c.unit, tenants: tenantNames, startDate: c.start_date, endDate: c.end_date }
  })

  // Ask Claude to match filenames → contracts
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const matchPrompt = `Match these Drive filenames to lease records. Return ONLY a JSON array, no explanation.

Lease records:
${JSON.stringify(contractDescriptions, null, 2)}

Filenames to match (index: name):
${files.map((f, i) => `${i}: "${f.name}"`).join('\n')}

Rules:
- Match by unit number and/or tenant name found in the filename
- If confident: set contractId to the matching lease id
- If uncertain: set contractId to null
- Return all file indexes even if no match

Return format: [{"fileIndex": 0, "contractId": "uuid-or-null", "confidence": "high/medium/low"}]`

  let matches = []
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: matchPrompt }],
    })
    const text = response.content[0]?.text || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    matches = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch (err) {
    return Response.json({ error: `Matching failed: ${err.message}` }, { status: 500 })
  }

  // Skip files already linked to this property
  const { data: existingDocs } = await supabase
    .from('documents')
    .select('drive_link')
    .eq('property_id', propertyId)

  const existingLinks = new Set((existingDocs || []).map(d => d.drive_link).filter(Boolean))

  let linked = 0
  const unmatched = []

  for (const match of matches) {
    const file = files[match.fileIndex]
    if (!file) continue

    if (!match.contractId || match.confidence === 'low') {
      unmatched.push(file.name)
      continue
    }
    if (existingLinks.has(file.webViewLink)) continue

    await supabase.from('documents').insert({
      landlord_id: landlordId,
      property_id: propertyId,
      contract_id: match.contractId,
      drive_link: file.webViewLink,
      file_name: file.name,
      document_type: 'lease',
    })
    linked++
  }

  // Collect filenames with no match attempt at all
  const matchedIndexes = new Set(matches.map(m => m.fileIndex))
  for (let i = 0; i < files.length; i++) {
    if (!matchedIndexes.has(i)) unmatched.push(files[i].name)
  }

  return Response.json({ linked, total: files.length, unmatched })
}
