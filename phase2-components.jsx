'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Inp, Sel, Btn, Badge, Icon, PageHeader } from './property-management-app'

const supabase = createClient()

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
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "32px 40px", fontFamily: "'Crimson Pro', Georgia, serif" }}>
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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.5px" }}>
            {property.address}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            {property.city}, {property.state} {property.zip} &middot; {property.type} &middot; {occupiedCount}/{units.length} occupied
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={openAdd}
            style={{ background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {units.map(unit => {
            const tenant = (data.tenants || []).find(t => t.unitId === unit.id)
            const isOccupied = unit.status === 'occupied'
            return (
              <div key={unit.id} style={{ background: "#1e293b", borderRadius: 14, padding: 22, border: "1px solid rgba(255,255,255,.07)", position: "relative" }}>
                {/* Edit button */}
                <button
                  onClick={() => openEdit(unit)}
                  style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                >
                  <Icon name="edit" size={13} />
                </button>

                {/* Unit number */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, background: isOccupied ? "rgba(217,119,6,.15)" : "rgba(148,163,184,.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Icon name="home" size={18} />
                  </div>
                  <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#f1f5f9", fontFamily: "'Playfair Display', Georgia, serif" }}>
                    Unit {unit.unitNumber}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                    {unit.bedrooms} bed / {unit.bathrooms} bath
                  </p>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#d97706" }}>
                    {unit.monthlyRent ? fmt(unit.monthlyRent) + "/mo" : "—"}
                  </span>
                  <Badge status={unit.status || "vacant"} />
                </div>

                {/* Tenant */}
                {isOccupied && tenant ? (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 12, fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>Tenant: </span>
                    <button
                      onClick={() => onNavigateToTenant && onNavigateToTenant(tenant.id)}
                      style={{ background: "none", border: "none", color: "#d97706", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13, fontFamily: "inherit" }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                    >
                      {tenant.name}
                    </button>
                  </div>
                ) : isOccupied ? (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 12, fontSize: 13, color: "#475569" }}>
                    Occupied — tenant unlinked
                  </div>
                ) : (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 12, fontSize: 13, color: "#475569" }}>
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
  const [filterProperty, setFilterProperty] = useState('')
  const [filterTenant, setFilterTenant] = useState('')
  const [filterType, setFilterType] = useState('')

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTenantId, setUploadTenantId] = useState('')
  const [uploadPropertyId, setUploadPropertyId] = useState('')
  const [uploadDocType, setUploadDocType] = useState('other')

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
    const res = await fetch('/api/documents/parse', { method: 'POST', body: JSON.stringify({ documentId: docId }), headers: { 'Content-Type': 'application/json' } })
    const json = await res.json()
    setParsing(null)
    if (json.extracted) setParsedResult({ docId, extracted: json.extracted })
  }

  const handleView = async (doc) => {
    const supabaseClient = createClient()
    const { data: signedData } = await supabaseClient.storage.from('documents').createSignedUrl(doc.filePath, 60)
    if (signedData?.signedUrl) window.open(signedData.signedUrl, '_blank')
  }

  // Filter documents
  let docs = data.documents || []
  if (filterProperty) docs = docs.filter(d => d.propertyId === filterProperty)
  if (filterTenant) docs = docs.filter(d => d.tenantId === filterTenant)
  if (filterType) docs = docs.filter(d => d.documentType === filterType)

  const docTypeBadgeColor = { application: '#0ea5e9', lease: '#d97706', other: '#64748b' }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: 0 }}>Documents</h1>
        <Btn onClick={() => setShowUploadModal(true)}>+ Upload Document</Btn>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} style={{ background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
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
      </div>

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
                {parsedResult?.docId === doc.id && (
                  <div style={{ marginTop: 10, background: '#0f172a', borderRadius: 8, padding: 12, fontSize: 12, color: '#94a3b8' }}>
                    <div style={{ color: '#d97706', fontWeight: 700, marginBottom: 6 }}>AI Extracted Data</div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(parsedResult.extracted, null, 2)}</pre>
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
          <button onClick={handleUpload} disabled={uploading || !uploadFile} style={{ width: '100%', padding: 12, background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer', opacity: uploading || !uploadFile ? 0.7 : 1 }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </Modal>
      )}
    </div>
  )
}
