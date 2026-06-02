'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Modal, Inp, Sel, Btn, Badge, Icon, PageHeader } from './property-management-app'

const PdfViewer = dynamic(() => import('./components/pdf-viewer'), {
  ssr: false,
  loading: () => <p style={{ color: '#94a3b8', padding: '24px', fontSize: 14 }}>Loading PDF…</p>,
})

const supabase = createClient()

// ─── toEmbedUrl — converts Google Drive share URL to an embeddable URL ────────
const toEmbedUrlDrive = (link) => {
  if (!link) return null
  const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#list`
  const fileMatch = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`
  return link
}

// ─── DocViewer — renders a document inline (PDF or Drive link) ────────────────
export const DocViewer = ({ doc, onClose }) => {
  const [signedUrl, setSignedUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!doc.driveLink && doc.filePath) {
      setLoading(true)
      supabase.storage.from('documents').createSignedUrl(doc.filePath, 300)
        .then(({ data }) => { setSignedUrl(data?.signedUrl || null) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [doc.id])

  const embedUrl = doc.driveLink ? toEmbedUrlDrive(doc.driveLink) : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 40 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '90vw', maxWidth: 900, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', fontFamily: "'Inter',system-ui,-apple-system,sans-serif", maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.fileName || doc.driveLink || 'Document'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <div style={{ padding: 16 }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8 }}
              allow="autoplay"
              title="Document"
            />
          ) : loading ? (
            <p style={{ color: '#94a3b8', padding: 24, fontSize: 14 }}>Loading…</p>
          ) : signedUrl ? (
            <PdfViewer url={signedUrl} />
          ) : (
            <p style={{ color: '#ef4444', padding: 24, fontSize: 14 }}>Could not load document.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n)

const EMPTY_UNIT_FORM = { unitNumber: "", bedrooms: "1", bathrooms: "1", monthlyRent: "", status: "vacant" }

export const PropertyDetailPage = ({ data, setData, refresh, user, propertyId, onBack, onNavigateToTenant }) => {
  const [showModal, setShowModal] = useState(false)
  const [editUnit, setEditUnit] = useState(null) // null = adding new, object = editing
  const [form, setForm] = useState(EMPTY_UNIT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const property = data.properties.find(p => p.id === propertyId)
  const units = (data.units || []).filter(u => u.propertyId === propertyId)

  const openAdd = () => {
    setEditUnit(null)
    setForm(EMPTY_UNIT_FORM)
    setError("")
    setShowModal(true)
  }

  const openEdit = (unit) => {
    setEditUnit(unit)
    setForm({
      unitNumber: unit.unitNumber || "",
      bedrooms: String(unit.bedrooms ?? 1),
      bathrooms: String(unit.bathrooms ?? 1),
      monthlyRent: String(unit.monthlyRent || ""),
      status: unit.status || "vacant",
    })
    setError("")
    setShowModal(true)
  }

  const save = async () => {
    if (!form.unitNumber.trim()) { setError("Unit number is required."); return; }
    setSaving(true)
    setError("")
    const payload = {
      property_id: propertyId,
      unit_number: form.unitNumber.trim(),
      bedrooms: parseInt(form.bedrooms) || 1,
      bathrooms: parseInt(form.bathrooms) || 1,
      monthly_rent: parseFloat(form.monthlyRent) || null,
      status: form.status,
    }
    let err
    if (editUnit) {
      const res = await supabase.from("units").update(payload).eq("id", editUnit.id)
      err = res.error
    } else {
      const res = await supabase.from("units").insert(payload)
      err = res.error
    }
    if (err) { setError(err.message); setSaving(false); return; }
    await refresh()
    setShowModal(false)
    setSaving(false)
  }

  if (!property) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 15, padding: 40 }}>
        Property not found.
      </div>
    )
  }

  const occupiedCount = units.filter(u => u.status === 'occupied').length

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "32px 40px", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.07)"}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", letterSpacing: "-0.5px" }}>
            {property.address}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            {property.city}, {property.state} {property.zip} &middot; {property.type} &middot; {occupiedCount}/{units.length} occupied
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={openAdd}
            style={{ background: "linear-gradient(135deg,#4f46e5,#4338ca)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <Icon name="plus" size={15} />
            Add Unit
          </button>
        </div>
      </div>

      {/* Units grid */}
      {units.length === 0 ? (
        <div style={{ textAlign: "center", color: "#475569", fontSize: 15, padding: "60px 0" }}>
          No units yet. Add the first unit for this property.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[...units].sort((a, b) => Number(a.unitNumber) - Number(b.unitNumber)).map(unit => {
            const tenants = (data.tenants || []).filter(t => t.unitId === unit.id && t.status === "current tenant")
            const isOccupied = unit.status === 'occupied'
            return (
              <div key={unit.id} style={{ background: "#1e293b", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,.07)", position: "relative" }}>
                <button
                  onClick={() => openEdit(unit)}
                  style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                >
                  <Icon name="edit" size={11} />
                </button>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, background: isOccupied ? "rgba(79,70,229,.15)" : "rgba(148,163,184,.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Icon name="home" size={14} />
                  </div>
                  <h3 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
                    Unit {unit.unitNumber}
                  </h3>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                    {unit.bedrooms} bed / {unit.bathrooms} bath
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>
                    {unit.monthlyRent ? fmt(unit.monthlyRent) + "/mo" : "—"}
                  </span>
                  <Badge status={unit.status || "vacant"} />
                </div>

                {isOccupied && tenants.length > 0 ? (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10 }}>
                    <div style={{ color: "#64748b", marginBottom: 5, textTransform: "uppercase", fontSize: 10, letterSpacing: ".5px", fontWeight: 600 }}>
                      {tenants.length === 1 ? "Tenant" : `Tenants (${tenants.length})`}
                    </div>
                    {tenants.map(t => (
                      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                        <button
                          onClick={() => onNavigateToTenant && onNavigateToTenant(t.id)}
                          style={{ background: "none", border: "none", color: "#a5b4fc", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 12, fontFamily: "inherit", textAlign: "left" }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                        >
                          {t.lastName ? `${t.name} ${t.lastName}` : t.name}
                        </button>
                        <span style={{ fontSize: 12, color: t.monthlyRent ? "#f1f5f9" : "#475569", fontWeight: 600 }}>
                          {t.monthlyRent ? fmt(t.monthlyRent) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : isOccupied ? (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10, fontSize: 12, color: "#475569" }}>
                    Occupied — tenant unlinked
                  </div>
                ) : (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10, fontSize: 12, color: "#475569" }}>
                    Vacant
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <Modal
          title={editUnit ? `Edit Unit ${editUnit.unitNumber}` : "Add Unit"}
          onClose={() => setShowModal(false)}
        >
          <Inp
            label="Unit Number"
            value={form.unitNumber}
            onChange={v => setF("unitNumber", v)}
            placeholder="e.g. 101, A, 2B"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp
              label="Bedrooms"
              value={form.bedrooms}
              onChange={v => setF("bedrooms", v)}
              type="number"
            />
            <Inp
              label="Bathrooms"
              value={form.bathrooms}
              onChange={v => setF("bathrooms", v)}
              type="number"
            />
          </div>
          <Inp
            label="Monthly Rent ($)"
            value={form.monthlyRent}
            onChange={v => setF("monthlyRent", v)}
            type="number"
            placeholder="e.g. 1500"
          />
          <Sel
            label="Status"
            value={form.status}
            onChange={v => setF("status", v)}
            options={[
              { value: "vacant", label: "Vacant" },
              { value: "occupied", label: "Occupied" },
            ]}
          />
          {error && (
            <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={save}>{saving ? "Saving…" : editUnit ? "Save Changes" : "Add Unit"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

export const DocumentsPageV2 = ({ data, setData, refresh, user }) => {
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [parsing, setParsing] = useState(null) // documentId being parsed
  const [parsedResult, setParsedResult] = useState(null) // { docId, extracted }
  const [parseError, setParseError] = useState(null)
  const [approvedFields, setApprovedFields] = useState({})
  const [approvedTenants, setApprovedTenants] = useState({})
  const [filterProperty, setFilterProperty] = useState('')
  const [filterTenant, setFilterTenant] = useState('')
  const [filterType, setFilterType] = useState('')

  // Lease record creation state
  const [leaseModalDocId, setLeaseModalDocId] = useState(null)
  const [leasePropertyId, setLeasePropertyId] = useState('')
  const [leaseUnitId, setLeaseUnitId] = useState('')
  const [leaseProcessing, setLeaseProcessing] = useState(false)
  const [leaseResult, setLeaseResult] = useState(null)

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTenantId, setUploadTenantId] = useState('')
  const [uploadPropertyId, setUploadPropertyId] = useState('')
  const [uploadDocType, setUploadDocType] = useState('other')

  // Inline viewer state
  const [viewingDoc, setViewingDoc] = useState(null)

  // Drive sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncError, setSyncError] = useState(null)

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('landlordId', user.id)
    if (uploadTenantId) formData.append('tenantId', uploadTenantId)
    if (uploadPropertyId) formData.append('propertyId', uploadPropertyId)
    formData.append('documentType', uploadDocType)

    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
    setUploading(false)
    if (res.ok) {
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadTenantId('')
      setUploadPropertyId('')
      setUploadDocType('other')
      refresh()
    }
  }

  const handleDelete = async (docId) => {
    await fetch('/api/documents/delete', { method: 'POST', body: JSON.stringify({ documentId: docId }), headers: { 'Content-Type': 'application/json' } })
    refresh()
  }

  const handleParse = async (docId) => {
    setParsing(docId)
    setParseError(null)
    setParsedResult(null)
    try {
      const res = await fetch('/api/documents/parse', { method: 'POST', body: JSON.stringify({ documentId: docId }), headers: { 'Content-Type': 'application/json' } })
      const json = await res.json()
      setParsing(null)
      if (!res.ok) {
        setParseError({ docId, message: json.error || 'Parse failed' })
        return
      }
      if (json.extracted) {
        setParsedResult({ docId, extracted: json.extracted })
        // Initialize all non-null fields as approved
        const fields = {}
        const fieldKeys = ['tenant_name','email','phone','home_address','move_in_date','move_out_date','lease_start_date','lease_end_date','has_cosigner','student_status','student_year','current_rent','zelle_name','age','rent_amount']
        fieldKeys.forEach(k => { fields[k] = json.extracted[k] != null && json.extracted[k] !== '' })
        setApprovedFields(fields)
        // Initialize all tenants as approved
        const people = [json.extracted.tenant_name, ...(json.extracted.housemates || [])].filter(n => n && n.trim())
        const tenants = {}
        people.forEach(name => { tenants[name] = true })
        setApprovedTenants(tenants)
      }
    } catch (err) {
      setParsing(null)
      setParseError({ docId, message: err.message || 'Network error' })
    }
  }

  const handleView = (doc) => setViewingDoc(doc)

  const handleProcessLease = async () => {
    setLeaseProcessing(true)
    const res = await fetch('/api/documents/process-lease', {
      method: 'POST',
      body: JSON.stringify({
        documentId: leaseModalDocId || parsedResult?.docId,
        propertyId: leasePropertyId,
        unitId: leaseUnitId,
        approvedTenants: Object.entries(approvedTenants).filter(([_, v]) => v).map(([name]) => name),
        approvedFields
      }),
      headers: { 'Content-Type': 'application/json' }
    })
    const json = await res.json()
    setLeaseProcessing(false)
    if (res.ok) {
      setLeaseResult(json)
      refresh()
    }
  }

  // Filter documents
  let docs = data.documents || []
  if (filterProperty) docs = docs.filter(d => d.propertyId === filterProperty)
  if (filterTenant) docs = docs.filter(d => d.tenantId === filterTenant)
  if (filterType) docs = docs.filter(d => d.documentType === filterType)

  const docTypeBadgeColor = { application: '#0ea5e9', lease: '#4f46e5', other: '#64748b' }

  return (
    <div style={{ padding: '24px 32px' }}>
      {viewingDoc && <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: 0 }}>Documents</h1>
        <Btn onClick={() => setShowUploadModal(true)}>+ Upload Document</Btn>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterProperty} onChange={e => { setFilterProperty(e.target.value); setSyncResult(null); setSyncError(null); }} style={{ background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
          <option value="">All Properties</option>
          {(data.properties || []).map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
        </select>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)} style={{ background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
          <option value="">All Tenants</option>
          {(data.tenants || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
          <option value="">All Types</option>
          <option value="application">Application</option>
          <option value="lease">Lease</option>
          <option value="other">Other</option>
        </select>
        {filterProperty && (() => {
          const prop = (data.properties || []).find(p => p.id === filterProperty)
          if (!prop?.driveLink) return null
          return (
            <button
              onClick={async () => {
                setSyncing(true)
                setSyncResult(null)
                setSyncError(null)
                const res = await fetch('/api/documents/sync-drive-folder', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ propertyId: filterProperty, landlordId: user.id }),
                })
                const json = await res.json().catch(() => ({}))
                setSyncing(false)
                if (!res.ok) { setSyncError(json.error || 'Sync failed.'); return }
                setSyncResult(json)
                if (json.linked > 0) refresh()
              }}
              disabled={syncing}
              style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1, fontFamily: 'inherit' }}
            >
              {syncing ? 'Syncing…' : '⟳ Sync from Drive'}
            </button>
          )
        })()}
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div style={{ background: syncResult.linked > 0 ? '#f0fdf4' : '#f8fafc', border: `1px solid ${syncResult.linked > 0 ? '#86efac' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#0f172a' }}>
          <strong>{syncResult.linked > 0 ? `✓ Linked ${syncResult.linked} of ${syncResult.total} files` : `No new files linked (${syncResult.total} files scanned)`}</strong>
          {syncResult.unmatched?.length > 0 && (
            <div style={{ marginTop: 6, color: '#64748b' }}>
              Could not match: {syncResult.unmatched.join(', ')}
            </div>
          )}
          {syncResult.failed?.length > 0 && (
            <div style={{ marginTop: 6, color: '#991b1b' }}>
              Failed to insert: {syncResult.failed.map(f => `${f.name} (${f.error})`).join(', ')}
            </div>
          )}
          {syncResult.message && <div style={{ marginTop: 4, color: '#64748b' }}>{syncResult.message}</div>}
        </div>
      )}
      {syncError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
          {syncError}
        </div>
      )}

      {/* Document list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {docs.length === 0 && <p style={{ color: '#94a3b8' }}>No documents yet.</p>}
        {docs.map(doc => {
          const tenant = (data.tenants || []).find(t => t.id === doc.tenantId)
          const property = (data.properties || []).find(p => p.id === doc.propertyId)
          return (
            <div key={doc.id} style={{ background: '#1e293b', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</span>
                  <span style={{ background: docTypeBadgeColor[doc.documentType] || '#64748b', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', flexShrink: 0 }}>{doc.documentType}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  {tenant && <span>{tenant.name}</span>}
                  {tenant && property && <span> · </span>}
                  {property && <span>{property.address}</span>}
                  <span style={{ marginLeft: 12 }}>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                </div>
                {/* Parse error display */}
                {parseError?.docId === doc.id && (
                  <div style={{ marginTop: 10, background: '#450a0a', borderRadius: 8, padding: 12, fontSize: 13, color: '#fca5a5' }}>
                    Error: {parseError.message}
                  </div>
                )}
                {/* Approval panel */}
                {parsedResult?.docId === doc.id && (
                  <div style={{ marginTop: 10, background: '#0f172a', borderRadius: 8, padding: 16, fontSize: 13 }}>
                    <div style={{ color: '#4f46e5', fontWeight: 700, marginBottom: 12, fontSize: 15 }}>Parsed Results - Review & Apply</div>

                    {/* Section 1: People on the lease */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>People Found</div>
                      {[parsedResult.extracted.tenant_name, ...(parsedResult.extracted.housemates || [])].filter(n => n && n.trim()).map((name, i) => {
                        const existingTenant = (data.tenants || []).find(t => t.name?.toLowerCase() === name.toLowerCase())
                        return (
                          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={approvedTenants[name] || false} onChange={() => setApprovedTenants(prev => ({ ...prev, [name]: !prev[name] }))} style={{ accentColor: '#4f46e5' }} />
                            <span style={{ color: '#f1f5f9' }}>{name}</span>
                            <span style={{ color: existingTenant ? '#22c55e' : '#818cf8', fontSize: 11, fontWeight: 600 }}>
                              {existingTenant ? 'matches existing tenant' : 'will create new profile'}
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    {/* Section 2: Extracted fields */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Lease Details</div>
                      {[
                        { key: 'lease_start_date', label: 'Start Date' },
                        { key: 'lease_end_date', label: 'End Date' },
                        { key: 'rent_amount', label: 'Monthly Rent', fmt: v => `$${v}` },
                      ].map(({ key, label, fmt }) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, cursor: 'pointer', opacity: parsedResult.extracted[key] == null ? 0.4 : 1 }}>
                          <input type="checkbox" checked={approvedFields[key] || false} onChange={() => setApprovedFields(prev => ({ ...prev, [key]: !prev[key] }))} disabled={parsedResult.extracted[key] == null} style={{ accentColor: '#4f46e5' }} />
                          <span style={{ color: '#94a3b8', width: 120, flexShrink: 0 }}>{label}</span>
                          <span style={{ color: '#f1f5f9' }}>{parsedResult.extracted[key] != null ? (fmt ? fmt(parsedResult.extracted[key]) : String(parsedResult.extracted[key])) : '—'}</span>
                        </label>
                      ))}

                      <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, marginTop: 14 }}>Tenant Info</div>
                      {[
                        { key: 'email', label: 'Email' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'home_address', label: 'Home Address' },
                        { key: 'age', label: 'Age' },
                        { key: 'student_status', label: 'Student Status' },
                        { key: 'student_year', label: 'Student Year' },
                        { key: 'zelle_name', label: 'Zelle Name' },
                        { key: 'has_cosigner', label: 'Has Cosigner', fmt: v => v ? 'Yes' : 'No' },
                      ].map(({ key, label, fmt }) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, cursor: 'pointer', opacity: parsedResult.extracted[key] == null ? 0.4 : 1 }}>
                          <input type="checkbox" checked={approvedFields[key] || false} onChange={() => setApprovedFields(prev => ({ ...prev, [key]: !prev[key] }))} disabled={parsedResult.extracted[key] == null} style={{ accentColor: '#4f46e5' }} />
                          <span style={{ color: '#94a3b8', width: 120, flexShrink: 0 }}>{label}</span>
                          <span style={{ color: '#f1f5f9' }}>{parsedResult.extracted[key] != null ? (fmt ? fmt(parsedResult.extracted[key]) : String(parsedResult.extracted[key])) : '—'}</span>
                        </label>
                      ))}
                    </div>

                    {/* Section 3: Property/Unit assignment */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Assignment</div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        <select value={leasePropertyId} onChange={e => { setLeasePropertyId(e.target.value); setLeaseUnitId('') }} style={{ flex: 1, background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                          <option value="">Select Property</option>
                          {(data.properties || []).map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
                        </select>
                        <select value={leaseUnitId} onChange={e => setLeaseUnitId(e.target.value)} style={{ flex: 1, background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                          <option value="">Select Unit</option>
                          {(data.units || []).filter(u => u.propertyId === leasePropertyId).map(u => <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => {
                          setLeaseModalDocId(doc.id)
                          setLeaseResult(null)
                          handleProcessLease()
                        }}
                        disabled={leaseProcessing || !leasePropertyId}
                        style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: leaseProcessing || !leasePropertyId ? 'not-allowed' : 'pointer', opacity: leaseProcessing || !leasePropertyId ? 0.7 : 1 }}>
                        {leaseProcessing ? 'Applying...' : 'Apply Selected'}
                      </button>
                      <button
                        onClick={() => { setParsedResult(null); setApprovedFields({}); setApprovedTenants({}) }}
                        style={{ background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>

                    {/* Success result */}
                    {leaseResult && (
                      <div style={{ marginTop: 12, background: '#052e16', borderRadius: 8, padding: 12, color: '#86efac', fontSize: 13 }}>
                        {leaseResult.created?.length > 0 && <div>Created: {leaseResult.created.join(', ')}</div>}
                        {leaseResult.updated?.length > 0 && <div>Updated: {leaseResult.updated.join(', ')}</div>}
                        {leaseResult.skipped?.length > 0 && <div>Skipped: {leaseResult.skipped.join(', ')}</div>}
                        {leaseResult.contractsCreated > 0 && <div>{leaseResult.contractsCreated} contract(s) created</div>}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => handleView(doc)} style={{ background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>View</button>
                <button onClick={() => handleParse(doc.id)} disabled={parsing === doc.id} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: parsing === doc.id ? 'not-allowed' : 'pointer', opacity: parsing === doc.id ? 0.7 : 1 }}>
                  {parsing === doc.id ? 'Parsing...' : 'Parse with AI'}
                </button>
                <button onClick={() => handleDelete(doc.id)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Upload modal */}
      {showUploadModal && (
        <Modal onClose={() => setShowUploadModal(false)}>
          <h3 style={{ color: '#f1f5f9', marginTop: 0 }}>Upload Document</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>File (PDF or DOCX)</label>
            <input type="file" accept=".pdf,.docx,.doc" onChange={e => setUploadFile(e.target.files[0])} style={{ color: '#f1f5f9', width: '100%' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Tenant (optional)</label>
            <select value={uploadTenantId} onChange={e => setUploadTenantId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 15 }}>
              <option value="">None</option>
              {(data.tenants || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Property (optional)</label>
            <select value={uploadPropertyId} onChange={e => setUploadPropertyId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 15 }}>
              <option value="">None</option>
              {(data.properties || []).map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Document Type</label>
            <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 15 }}>
              <option value="application">Application</option>
              <option value="lease">Lease</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button onClick={handleUpload} disabled={uploading || !uploadFile} style={{ width: '100%', padding: 12, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer', opacity: uploading || !uploadFile ? 0.7 : 1 }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </Modal>
      )}

    </div>
  )
}

// ─── TENANT CONTACT PAGE ──────────────────────────────────────────────────────
const fmt2 = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n)

const InfoRow = ({ label, value, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 14 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</span>
    {children || <span style={{ fontSize: 14, color: value ? "#f1f5f9" : "#475569" }}>{value || "—"}</span>}
  </div>
)

const TenantCard = ({ title, children }) => (
  <div style={{ background: "#1e293b", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,.07)" }}>
    <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{title}</h3>
    {children}
  </div>
)

const EMPTY_TENANT_FORM = {
  name: "", phone: "", propertyId: "", unit: "", status: "current tenant", monthlyRent: "",
  moveInDate: "", moveOutDate: "", hasCosigner: false, studentStatus: "", studentYear: "",
  zelleName: "", homeAddress: "", age: "", unitId: "", notes: "", securityDeposit: "",
}

export const TenantContactPage = ({ data, setData, refresh, user, tenantId, onBack, onNavigateToProperty }) => {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_TENANT_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [selectedDocId, setSelectedDocId] = useState("")
  const [showImportPreview, setShowImportPreview] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(null)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const tenant = (data.tenants || []).find(t => t.id === tenantId)

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        phone: tenant.phone || "",
        propertyId: tenant.propertyId || "",
        unit: tenant.unit || "",
        status: tenant.status || "current tenant",
        monthlyRent: tenant.monthlyRent ? String(tenant.monthlyRent) : "",
        moveInDate: tenant.moveInDate || "",
        moveOutDate: tenant.moveOutDate || "",
        hasCosigner: tenant.hasCosigner || false,
        studentStatus: tenant.studentStatus || "",
        studentYear: tenant.studentYear || "",
        zelleName: tenant.zelleName || "",
        homeAddress: tenant.homeAddress || "",
        age: tenant.age ? String(tenant.age) : "",
        unitId: tenant.unitId || "",
        notes: tenant.notes || "",
        securityDeposit: tenant.securityDeposit ? String(tenant.securityDeposit) : "",
      })
    }
    setEditing(false)
    setSaveError("")
  }, [tenantId])

  if (!tenant) {
    return (
      <div style={{ background: "#0f172a", minHeight: "100vh", padding: "32px 40px", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
        {viewingDoc && <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
        <button onClick={onBack} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", marginBottom: 24 }}>
          ← Back
        </button>
        <p style={{ color: "#94a3b8", fontSize: 15 }}>Tenant not found.</p>
      </div>
    )
  }

  // Resolve linked data
  const property = (data.properties || []).find(p => p.id === tenant.propertyId)
  const linkedUnit = (data.units || []).find(u => u.id === tenant.unitId)
  const housemates = (data.tenants || []).filter(t => t.unitId && t.unitId === tenant.unitId && t.id !== tenantId && t.status === "current tenant")
  const tenantDocs = (data.documents || []).filter(d => d.tenantId === tenantId)
  const parsableDocs = tenantDocs.filter(d => d.aiExtracted !== null && d.aiExtracted !== undefined)

  const selectedParsedDoc = parsableDocs.find(d => d.id === selectedDocId)

  const handleSave = async () => {
    setSaving(true)
    setSaveError("")
    const res = await fetch("/api/auth/update-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        name: form.name,
        phone: form.phone,
        propertyId: form.propertyId || null,
        unit: form.unit,
        status: form.status,
        monthlyRent: form.monthlyRent || null,
        moveInDate: form.moveInDate || null,
        moveOutDate: form.moveOutDate || null,
        hasCosigner: form.hasCosigner,
        studentStatus: form.studentStatus || null,
        studentYear: form.studentYear || null,
        zelleName: form.zelleName || null,
        homeAddress: form.homeAddress || null,
        age: form.age ? Number(form.age) : null,
        unitId: form.unitId || null,
        notes: form.notes || null,
        securityDeposit: form.securityDeposit === "" ? null : form.securityDeposit,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveError(json.error || "Something went wrong."); return; }
    await refresh()
    setEditing(false)
  }

  const handleApplyExtracted = async (extracted) => {
    setSaving(true)
    setSaveError("")
    // Map AI-extracted fields to API shape - keys may vary by document parser output
    const payload = {
      tenantId,
      name: extracted.name || tenant.name,
      phone: extracted.phone || tenant.phone || null,
      propertyId: tenant.propertyId || null,
      unit: extracted.unit || tenant.unit || null,
      status: tenant.status,
      monthlyRent: extracted.monthly_rent || extracted.monthlyRent || tenant.monthlyRent || null,
      moveInDate: extracted.move_in_date || extracted.moveInDate || tenant.moveInDate || null,
      moveOutDate: extracted.move_out_date || extracted.moveOutDate || tenant.moveOutDate || null,
      hasCosigner: extracted.has_cosigner ?? extracted.hasCosigner ?? tenant.hasCosigner,
      studentStatus: extracted.student_status || extracted.studentStatus || tenant.studentStatus || null,
      studentYear: extracted.student_year || extracted.studentYear || tenant.studentYear || null,
      zelleName: extracted.zelle_name || extracted.zelleName || tenant.zelleName || null,
      homeAddress: extracted.home_address || extracted.homeAddress || tenant.homeAddress || null,
      age: extracted.age ? Number(extracted.age) : (tenant.age || null),
      unitId: tenant.unitId || null,
      notes: tenant.notes || null,
      securityDeposit: tenant.securityDeposit || null,
    }
    const res = await fetch("/api/auth/update-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveError(json.error || "Import failed."); return; }
    await refresh()
    setShowImportPreview(false)
    setSelectedDocId("")
  }

  const handleViewDoc = (doc) => setViewingDoc(doc)

  const docTypeBadgeColor = { application: '#0ea5e9', lease: '#4f46e5', other: '#64748b' }
  const displayRent = linkedUnit?.monthlyRent || tenant.monthlyRent

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "32px 40px", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      {viewingDoc && <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.07)"}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#3730a3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
            {tenant.name.charAt(0)}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", letterSpacing: "-0.5px" }}>
              {tenant.name}{tenant.lastName ? ` ${tenant.lastName}` : ""}
            </h1>
            <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 13 }}>
              {tenant.email}
              {tenant.status && <span style={{ marginLeft: 10 }}><Badge status={tenant.status} /></span>}
            </p>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setSaveError(""); }} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "9px 18px", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ background: "linear-gradient(135deg,#4f46e5,#4338ca)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "9px 18px", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.07)"}
            >
              <Icon name="edit" size={13} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 13, marginBottom: 20 }}>
          {saveError}
        </div>
      )}

      {/* 2-column grid of info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>

        {/* Contact */}
        <TenantCard title="Contact">
          {editing ? (
            <>
              <Inp label="Phone" value={form.phone} onChange={v => setF("phone", v)} />
              <Inp label="Zelle Name" value={form.zelleName} onChange={v => setF("zelleName", v)} placeholder="Name or phone number" />
              <Inp label="Home Address" value={form.homeAddress} onChange={v => setF("homeAddress", v)} placeholder="Permanent home address" />
            </>
          ) : (
            <>
              <InfoRow label="Email" value={tenant.email} />
              <InfoRow label="Phone" value={tenant.phone} />
              <InfoRow label="Zelle Name" value={tenant.zelleName} />
              <InfoRow label="Home Address" value={tenant.homeAddress} />
            </>
          )}
        </TenantCard>

        {/* Residence */}
        <TenantCard title="Residence">
          {editing ? (
            <>
              <Sel label="Property" value={form.propertyId} onChange={v => setF("propertyId", v)}
                options={[{ value: "", label: "— No property —" }, ...(data.properties || []).map(p => ({ value: p.id, label: p.address }))]}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Unit</div>
                {(() => {
                  const propUnits = (data.units || []).filter(u => u.propertyId === form.propertyId);
                  return (
                    <select
                      value={form.unitId || ""}
                      onChange={e => {
                        const uid = e.target.value;
                        const matched = propUnits.find(u => u.id === uid);
                        setF("unitId", uid || "");
                        setF("unit", matched ? matched.unitNumber : "");
                      }}
                      style={{ width: "100%", background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}
                      disabled={!form.propertyId}
                    >
                      {!form.propertyId ? (
                        <option value="">— Select a property first —</option>
                      ) : propUnits.length === 0 ? (
                        <>
                          <option value="">— No unit assigned —</option>
                          <option value="" disabled>No units — add units first from the property page</option>
                        </>
                      ) : (
                        <>
                          <option value="">— No unit assigned —</option>
                          {propUnits.map(u => (
                            <option key={u.id} value={u.id}>
                              Unit {u.unitNumber} — {u.bedrooms}bd/{u.bathrooms}ba ({u.status})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  );
                })()}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Inp label="Move-in Date" value={form.moveInDate} onChange={v => setF("moveInDate", v)} type="date" />
                <Inp label="Move-out Date" value={form.moveOutDate} onChange={v => setF("moveOutDate", v)} type="date" />
              </div>
              <Inp label="Monthly Rent ($)" value={form.monthlyRent} onChange={v => setF("monthlyRent", v)} type="number" placeholder="e.g. 1500" />
              <Inp label="Security Deposit ($)" value={form.securityDeposit} onChange={v => setF("securityDeposit", v)} type="number" placeholder="e.g. 1500" />
            </>
          ) : (
            <>
              <InfoRow label="Property">
                {property ? (
                  <button onClick={() => onNavigateToProperty && onNavigateToProperty(property.id)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#4f46e5", fontSize: 14, fontWeight: 600, fontFamily: "inherit", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >
                    {property.address}
                  </button>
                ) : <span style={{ color: "#475569", fontSize: 14 }}>—</span>}
              </InfoRow>
              <InfoRow label="Unit">
                {linkedUnit ? (
                  <span style={{ fontSize: 14, color: "#f1f5f9" }}>Unit {linkedUnit.unitNumber} ({linkedUnit.bedrooms}bd / {linkedUnit.bathrooms}ba)</span>
                ) : <span style={{ color: "#475569", fontSize: 14 }}>{tenant.unit || "—"}</span>}
              </InfoRow>
              <InfoRow label="Move-in Date" value={tenant.moveInDate} />
              <InfoRow label="Move-out Date" value={tenant.moveOutDate} />
              <InfoRow label="Monthly Rent">
                <span style={{ fontSize: 15, fontWeight: 700, color: displayRent ? "#a5b4fc" : "#475569" }}>
                  {displayRent ? fmt2(displayRent) + "/mo" : "—"}
                </span>
              </InfoRow>
              <InfoRow label="Security Deposit">
                {tenant.securityDeposit && +tenant.securityDeposit > 0 ? (
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#a5b4fc" }}>{fmt2(+tenant.securityDeposit)}</span>
                ) : (
                  <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>Not received</span>
                )}
              </InfoRow>
            </>
          )}
        </TenantCard>

        {/* Personal Info */}
        <TenantCard title="Personal Info">
          {editing ? (
            <>
              <Inp label="Age" value={form.age} onChange={v => setF("age", v)} type="number" placeholder="e.g. 22" />
              <Sel label="Student Status" value={form.studentStatus} onChange={v => setF("studentStatus", v)}
                options={[{ value: "", label: "—" }, { value: "student", label: "Student" }, { value: "non-student", label: "Non-student" }]}
              />
              <Inp label="Student Year" value={form.studentYear} onChange={v => setF("studentYear", v)} placeholder="e.g. Junior, 2nd year" />
              <Sel label="Has Cosigner" value={String(form.hasCosigner)} onChange={v => setF("hasCosigner", v === "true")}
                options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]}
              />
            </>
          ) : (
            <>
              <InfoRow label="Age" value={tenant.age ? String(tenant.age) : null} />
              <InfoRow label="Student Status" value={tenant.studentStatus} />
              <InfoRow label="Student Year" value={tenant.studentYear} />
              <InfoRow label="Has Cosigner">
                <Badge status={tenant.hasCosigner ? "active" : "inactive"} />
              </InfoRow>
            </>
          )}
        </TenantCard>

        {/* Notes */}
        <TenantCard title="Notes">
          {editing ? (
            <textarea
              value={form.notes || ""}
              onChange={e => setF("notes", e.target.value)}
              placeholder="Internal notes about this tenant"
              rows={5}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #334155", borderRadius: 8, fontSize: 14, color: "#f1f5f9", background: "#0f172a", boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical" }}
            />
          ) : (
            tenant.notes ? (
              <p style={{ margin: 0, fontSize: 14, color: "#f1f5f9", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{tenant.notes}</p>
            ) : (
              <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>No notes</p>
            )
          )}
        </TenantCard>

        {/* Housemates */}
        <TenantCard title="Housemates">
          {housemates.length === 0 ? (
            <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>No housemates</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {housemates.map(hm => (
                <div key={hm.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {hm.name.charAt(0)}
                  </div>
                  <span style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 600 }}>{hm.name}</span>
                </div>
              ))}
            </div>
          )}
        </TenantCard>

        {/* Documents */}
        <TenantCard title="Documents">
          {tenantDocs.length === 0 ? (
            <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>No documents uploaded for this tenant.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tenantDocs.map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: doc.documentType === "lease" ? "rgba(79,70,229,.08)" : "rgba(255,255,255,.03)", borderRadius: 9, padding: "10px 14px", border: doc.documentType === "lease" ? "1px solid rgba(79,70,229,.2)" : "1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName}</span>
                      <span style={{ background: docTypeBadgeColor[doc.documentType] || "#64748b", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "uppercase", flexShrink: 0 }}>{doc.documentType}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                  <button onClick={() => handleViewDoc(doc)} style={{ background: "#334155", color: "#f1f5f9", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </TenantCard>

        {/* Import from Document - only shown when parsable docs exist */}
        {parsableDocs.length > 0 && (
          <TenantCard title="Import from Document">
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              Auto-fill tenant profile fields from AI-parsed documents.
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Select Document</label>
              <select
                value={selectedDocId}
                onChange={e => { setSelectedDocId(e.target.value); setShowImportPreview(false); }}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit" }}
              >
                <option value="">— Choose a parsed document —</option>
                {parsableDocs.map(d => (
                  <option key={d.id} value={d.id}>{d.fileName}</option>
                ))}
              </select>
            </div>
            {selectedDocId && !showImportPreview && (
              <button
                onClick={() => setShowImportPreview(true)}
                style={{ background: "linear-gradient(135deg,#4f46e5,#4338ca)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Preview &amp; Apply
              </button>
            )}
            {showImportPreview && selectedParsedDoc && (
              <div style={{ marginTop: 12 }}>
                <div style={{ background: "#0f172a", borderRadius: 10, padding: 14, marginBottom: 14, border: "1px solid #334155" }}>
                  <div style={{ color: "#4f46e5", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Extracted Fields</div>
                  <pre style={{ margin: 0, fontSize: 12, color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto" }}>
                    {JSON.stringify(selectedParsedDoc.aiExtracted, null, 2)}
                  </pre>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleApplyExtracted(selectedParsedDoc.aiExtracted)}
                    disabled={saving}
                    style={{ background: "linear-gradient(135deg,#4f46e5,#4338ca)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? "Applying…" : "Apply to Profile"}
                  </button>
                  <button
                    onClick={() => setShowImportPreview(false)}
                    style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "9px 18px", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </TenantCard>
        )}

      </div>
    </div>
  )
}
