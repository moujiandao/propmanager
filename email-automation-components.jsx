'use client'
import { useState, useRef, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Inp, Sel, Btn, Icon, PageHeader, genderSuffix } from './property-management-app'
import { MERGE_TAGS, renderTemplate, sampleContext } from '@/lib/email/merge'
import { availableGeneratorUnits, buildGeneratorGroups, buildGeneratorRow, isGeneratorTableComplete } from '@/lib/email/generator'
import { EVENT_TYPES } from '@/lib/email/events'
import { fmtDate } from '@/lib/email/format'

const supabase = createClient()

const card = { background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #f5f5f5' }
const emptyCard = { ...card, textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }
const dangerBtn = { padding: '10px 20px', borderRadius: 9, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 6, display: 'inline-flex' }
const footerRow = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }
const errText = { color: '#ef4444', fontSize: 13, margin: '8px 0 0' }

// Every name in this file lands in a string context (a <select> option, a
// recipient list), so the gender mark comes through as a bare glyph without
// its colour -- the same degradation genderSuffix exists for.
const fullName = (x) => [x.name, x.lastName].filter(Boolean).join(' ') + genderSuffix(x)
const nl2br = (s) => s ? s.replace(/\n/g, '<br>') : ''
const isActiveTenant = (x) => x.status === 'current tenant' || x.status === 'future tenant'

// Strip tags to safe plaintext (used for externally-authored inbound reply bodies).
const stripTags = (s) => !s ? '' : String(s).replace(/<br\s*\/?>(?=\s*)/gi, '\n').replace(/<[^>]+>/g, '')

// Local toggle (the monolith's Toggle isn't exported).
const Toggle = ({ value, onChange }) => (
  <button type="button" onClick={() => onChange(!value)}
    style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0, background: value ? '#111111' : '#cbd5e1', position: 'relative', transition: 'background .15s' }}>
    <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
  </button>
)

// Translated label for an event type value.
const eventLabel = (t, value) => ({
  move_out: t.evtMoveOut, move_in: t.evtMoveIn, lease_end: t.evtLeaseEnd,
  projected_move_out: t.evtProjectedMoveOut, rent_due: t.evtRentDue,
}[value] || value)

// ─── Merge-tag insert bar ─────────────────────────────────────────────────────
const MergeTagBar = ({ onInsert, t, tags = MERGE_TAGS }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
    <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center', marginRight: 4 }}>{t.insertField}:</span>
    {tags.map(m => (
      <button key={m.tag} type="button" title={m.label} onClick={() => onInsert(`{${m.tag}}`)}
        style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #eaeaea', background: '#fafafa', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
        {`{${m.tag}}`}
      </button>
    ))}
  </div>
)

// ─── Template editor modal ────────────────────────────────────────────────────
const TemplateEditor = ({ initial, user, t, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name || '')
  const [subject, setSubject] = useState(initial?.subject || '')
  const [body, setBody] = useState(initial?.bodyText || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const bodyRef = useRef(null)

  const insertTag = (tag) => {
    const el = bodyRef.current
    if (!el) { setBody(b => b + tag); return }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    setBody(body.slice(0, start) + tag + body.slice(end))
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + tag.length })
  }

  const preview = useMemo(
    () => renderTemplate({ subject, bodyText: body }, sampleContext()),
    [subject, body]
  )

  const save = async () => {
    if (!name.trim() || !subject.trim()) { setErr(t.templateNameSubjectRequired); return }
    setSaving(true); setErr(null)
    const row = { landlord_id: user.id, name: name.trim(), subject: subject.trim(), body_text: body, body_html: null, updated_at: new Date().toISOString() }
    const res = initial?.id
      ? await supabase.from('email_templates').update(row).eq('id', initial.id)
      : await supabase.from('email_templates').insert(row)
    setSaving(false)
    if (res.error) { setErr(res.error.message); return }
    onSaved()
  }

  return (
    <Modal title={initial?.id ? t.editTemplateTitle : t.newTemplate} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <Inp label={t.templateName} value={name} onChange={setName} placeholder={t.templateNamePlaceholder} />
          <Inp label={t.templateSubject} value={subject} onChange={setSubject} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', margin: '12px 0 6px' }}>{t.templateBody}</label>
          <MergeTagBar onInsert={insertTag} t={t} />
          <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)}
            style={{ width: '100%', minHeight: 220, padding: '12px 14px', border: '1px solid #eaeaea', borderRadius: 9, fontSize: 13, color: '#374151', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }} />
          {err && <p style={errText}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <Btn variant="secondary" onClick={onClose}>{t.cancel}</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? t.saving : t.save}</Btn>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t.preview}</label>
          <div style={{ border: '1px solid #eaeaea', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #eaeaea', fontSize: 13, fontWeight: 600, color: '#111111' }}>{preview.subject || t.previewNoSubject}</div>
            <div style={{ padding: '16px 14px', fontSize: 14, color: '#111111', minHeight: 180 }} dangerouslySetInnerHTML={{ __html: preview.html || `<span style="color:#9ca3af">${t.previewEmpty}</span>` }} />
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{t.previewSampleNote}</p>
        </div>
      </div>
    </Modal>
  )
}

// ─── Test-send modal ──────────────────────────────────────────────────────────
const TestSendModal = ({ template, eventType, data, user, t, onClose }) => {
  const [toEmail, setToEmail] = useState(user.email || '')
  const [tenantId, setTenantId] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const tenantOptions = [{ value: '', label: t.testSampleData },
    ...(data.tenants || []).filter(isActiveTenant)
      .map(x => ({ value: x.id, label: fullName(x) }))]

  const send = async () => {
    if (!toEmail.trim()) { setResult({ error: t.testRecipientRequired }); return }
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/email/test-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: user.id, toEmail: toEmail.trim(), templateId: template.id, tenantId: tenantId || undefined, eventType: eventType || undefined }),
      })
      const json = await res.json()
      if (!res.ok) setResult({ error: json?.error || t.testFailed })
      else setResult({ ok: true })
    } catch (e) { setResult({ error: e.message }) }
    setSending(false)
  }

  return (
    <Modal title={t.testSendTitle} onClose={onClose}>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>{t.testSendDesc}</p>
      <Inp label={t.testRecipient} value={toEmail} onChange={setToEmail} type="email" />
      <Sel label={t.testUseTenant} value={tenantId} onChange={setTenantId} options={tenantOptions} />
      {result?.error && <p style={errText}>{result.error}</p>}
      {result?.ok && <p style={{ color: '#22c55e', fontSize: 13, margin: '8px 0 0' }}>{t.testSent}</p>}
      <div style={footerRow}>
        <Btn variant="secondary" onClick={onClose}>{t.cancel}</Btn>
        <Btn onClick={send} disabled={sending}>{sending ? t.sending : t.send}</Btn>
      </div>
    </Modal>
  )
}

// ─── Templates tab ────────────────────────────────────────────────────────────
const TemplatesTab = ({ data, user, t, refresh }) => {
  const [editing, setEditing] = useState(null)   // template object or {} for new
  const [testing, setTesting] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const templates = data.emailTemplates || []

  const del = async () => {
    await supabase.from('email_templates').delete().eq('id', confirmDel.id)
    setConfirmDel(null)
    refresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Btn icon="plus" onClick={() => setEditing({})}>{t.newTemplate}</Btn>
      </div>
      {templates.length === 0 ? (
        <div style={emptyCard}>{t.noTemplates}</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {templates.map(tpl => (
            <div key={tpl.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111111' }}>{tpl.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.subject}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Btn size="sm" variant="secondary" icon="mail" onClick={() => setTesting(tpl)}>{t.sendTest}</Btn>
                <Btn size="sm" variant="ghost" icon="edit" onClick={() => setEditing(tpl)}>{t.edit}</Btn>
                <button onClick={() => setConfirmDel(tpl)} title={t.deleteTemplate} style={iconBtn}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <TemplateEditor initial={editing} user={user} t={t} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
      {testing && <TestSendModal template={testing} data={data} user={user} t={t} onClose={() => setTesting(null)} />}
      {confirmDel && (
        <Modal title={t.deleteTemplate} onClose={() => setConfirmDel(null)}>
          <p style={{ fontSize: 14, color: '#374151', margin: '0 0 20px' }}>{t.confirmDeleteTemplate} <strong>{confirmDel.name}</strong>?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setConfirmDel(null)}>{t.cancel}</Btn>
            <button onClick={del} style={dangerBtn}>{t.deleteTemplate}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Local-only generator. It has no send action, API call, Supabase write, or persistence.
const EmailGeneratorTab = ({ data, t }) => {
  const [subject, setSubject] = useState(t.generatorDefaultSubject)
  const [body, setBody] = useState(t.generatorDefaultBody)
  const [rows, setRows] = useState([{ id: 1, unitId: '', month: '', amount: '' }])
  const [generated, setGenerated] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const bodyRef = useRef(null)
  const nextRowId = useRef(2)
  const units = availableGeneratorUnits(data.units || [], data.properties || [])
  const tenants = data.tenants || []
  const properties = data.properties || []
  const unitById = new Map(units.map(unit => [unit.id, unit]))
  const generatorTags = [
    { tag: 'name', label: t.generatorFieldName },
    { tag: 'unit_number', label: t.generatorFieldUnit },
    { tag: 'month_year', label: t.generatorFieldMonth },
    { tag: 'amount', label: t.generatorFieldAmount },
    { tag: 'bill_lines', label: t.generatorFieldBillLines },
  ]

  const unitOptions = units.map(unit => {
    const property = properties.find(x => x.id === unit.propertyId)
    const prefix = property?.address ? `${property.address} · ` : ''
    return { value: unit.id, label: `${prefix}${t.generatorUnit} ${unit.unitNumber}` }
  })

  const rowOutputs = rows.map(row => {
    const unit = unitById.get(row.unitId)
    const details = buildGeneratorRow({ tenants, unit, month: row.month, amount: row.amount })
    return { row, details }
  })
  const outputs = buildGeneratorGroups({ rows, units, tenants }).map(details => ({
    details,
    rendered: renderTemplate({ subject, bodyText: body }, details.mergeValues),
  }))
  const tableComplete = isGeneratorTableComplete(rows)

  const updateRow = (id, field, value) => {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row))
    setGenerated(false)
    setErr('')
  }

  const addRow = () => {
    setRows(current => [...current, { id: nextRowId.current++, unitId: '', month: '', amount: '' }])
    setGenerated(false)
  }

  const removeRow = (id) => {
    setRows(current => current.filter(row => row.id !== id))
    setGenerated(false)
  }

  const insertTag = (tag) => {
    const el = bodyRef.current
    if (!el) { setBody(value => value + tag); return }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    setBody(body.slice(0, start) + tag + body.slice(end))
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + tag.length })
  }

  const generate = () => {
    if (!tableComplete) {
      setErr(t.generatorCompleteRows)
      setGenerated(false)
      return
    }
    setErr('')
    setGenerated(true)
  }

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(current => current === key ? '' : current), 1600)
    } catch {
      setErr(t.generatorCopyFailed)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ ...card, background: '#fafafa' }}>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{t.generatorIntro}</div>
        <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, marginTop: 6 }}>{t.generatorNeverSends}</div>
      </div>

      <div style={card}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t.generatorSubject}</label>
        <input value={subject} onChange={event => setSubject(event.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #eaeaea', borderRadius: 9, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', margin: '14px 0 6px' }}>{t.generatorBody}</label>
        <MergeTagBar onInsert={insertTag} t={t} tags={generatorTags} />
        <textarea ref={bodyRef} value={body} onChange={event => setBody(event.target.value)}
          style={{ width: '100%', minHeight: 250, padding: '12px 14px', border: '1px solid #eaeaea', borderRadius: 9, fontSize: 13, color: '#374151', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }} />
      </div>

      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[t.generatorUnit, t.generatorNames, t.generatorMonth, t.generatorAmount, ''].map((label, index) => (
                <th key={`${label}-${index}`} style={{ padding: '0 8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowOutputs.map(({ row, details }) => (
              <tr key={row.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 8px' }}>
                  <select value={row.unitId} onChange={event => updateRow(row.id, 'unitId', event.target.value)}
                    aria-label={t.generatorUnit}
                    style={{ width: '100%', minWidth: 210, padding: '9px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontFamily: 'inherit' }}>
                    <option value="">{t.generatorSelectUnit}</option>
                    {unitOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td style={{ padding: '10px 8px', minWidth: 180, fontSize: 13, color: details.mergeValues.name ? '#374151' : '#9ca3af' }}>
                  {details.mergeValues.name || (row.unitId && row.month ? t.generatorNoTenants : t.generatorEnterUnitMonth)}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <input type="month" value={row.month} onChange={event => updateRow(row.id, 'month', event.target.value)}
                    aria-label={t.generatorMonth}
                    style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'inherit' }} />
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <input type="number" min="0" step="0.01" value={row.amount} onChange={event => updateRow(row.id, 'amount', event.target.value)}
                    aria-label={t.generatorAmount}
                    style={{ width: 110, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'inherit' }} />
                </td>
                <td style={{ padding: '10px 8px', width: 40 }}>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(row.id)} title={t.generatorRemoveRow} style={iconBtn}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <Btn size="sm" variant="secondary" icon="plus" onClick={addRow}>{t.generatorAddRow}</Btn>
          <Btn icon="sparkles" onClick={generate}>{t.generatorGenerate}</Btn>
        </div>
        {err && <p style={errText}>{err}</p>}
      </div>

      {generated && tableComplete && (
        <div style={{ display: 'grid', gap: 14 }}>
          <h3 style={{ margin: '4px 0 0', fontSize: 17, color: '#111111' }}>{t.generatorResults}</h3>
          {outputs.map(({ details, rendered }, index) => {
            const resultKey = `${details.unitId}-${index}`
            const subjectKey = `subject-${resultKey}`
            const bodyKey = `body-${resultKey}`
            const emailsKey = `emails-${resultKey}`
            return (
              <div key={resultKey} style={{ ...card, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 20 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 8 }}>{rendered.subject || t.previewNoSubject}</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{rendered.text}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <Btn size="sm" variant="secondary" onClick={() => copy(rendered.subject, subjectKey)}>
                      {copied === subjectKey ? t.generatorCopied : t.generatorCopySubject}
                    </Btn>
                    <Btn size="sm" variant="secondary" onClick={() => copy(rendered.text, bodyKey)}>
                      {copied === bodyKey ? t.generatorCopied : t.generatorCopyBody}
                    </Btn>
                  </div>
                </div>
                <aside style={{ borderLeft: '1px solid #eaeaea', paddingLeft: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 7 }}>{t.generatorEmailAddresses}</div>
                  <div style={{ fontSize: 13, color: details.emailAddresses ? '#374151' : '#9ca3af', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                    {details.emailAddresses || t.generatorNoEmailAddresses}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Btn size="sm" variant="secondary" disabled={!details.emailAddresses} onClick={() => copy(details.emailAddresses, emailsKey)}>
                      {copied === emailsKey ? t.generatorCopied : t.generatorCopyEmails}
                    </Btn>
                  </div>
                  {details.missingEmailNames.length > 0 && (
                    <p style={{ color: '#b45309', fontSize: 12, margin: '10px 0 0', lineHeight: 1.4 }}>
                      {t.generatorMissingEmails(details.missingEmailNames.join(', '))}
                    </p>
                  )}
                </aside>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Batch send flow (Run now): preview → review/edit → confirm → result ──────
// Drives the human-reviewed batch send for one automation. Backed by the
// /api/email/batches routes; messages are persisted draft rows (resumable).
//
// API responses use snake_case (to_email, body_html, body_text). PATCH upserts
// use camelCase (toEmail, bodyHtml, bodyText, tenantId) — we map between them.
const BatchSendModal = ({ automation, data, user, t, onClose, refresh }) => {
  const [step, setStep] = useState('loading')   // loading | preview | review | result | error
  const [batch, setBatch] = useState(null)
  const [messages, setMessages] = useState([])  // snake_case rows from the API
  const [errMsg, setErrMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [addTenantId, setAddTenantId] = useState('')
  const [result, setResult] = useState(null)
  const loadedRef = useRef(false)

  const tenants = data.tenants || []
  const tenantName = (id) => {
    const x = tenants.find(v => v.id === id)
    return x ? (fullName(x) || t.batchNoName) : t.batchNoName
  }

  // POST /api/email/batches — idempotent: resumes an existing draft if present.
  const runNow = async () => {
    setStep('loading'); setErrMsg(null)
    try {
      const res = await fetch('/api/email/batches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: user.id, automationId: automation.id }),
      })
      const json = await res.json()
      if (!res.ok) { setErrMsg(json?.error || t.batchLoadFailed); setStep('error'); return }
      setBatch(json.batch)
      setMessages(json.messages || [])
      setStep('preview')
    } catch (e) { setErrMsg(e.message || t.batchLoadFailed); setStep('error') }
  }

  // Run on mount once (ref guard survives StrictMode's double-invoke of effects).
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    runNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // PATCH /api/email/batches/[id] — persist edits/adds/removes, re-render from response.
  const patch = async ({ upserts = [], deleteIds = [] }) => {
    setSaving(true); setErrMsg(null)
    try {
      const res = await fetch(`/api/email/batches/${batch.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: user.id, upserts, deleteIds }),
      })
      const json = await res.json()
      setSaving(false)
      if (!res.ok) { setErrMsg(json?.error || t.batchSaveFailed); return false }
      setBatch(json.batch)
      setMessages(json.messages || [])
      return true
    } catch (e) { setSaving(false); setErrMsg(e.message || t.batchSaveFailed); return false }
  }

  // Local edit of a draft row; persisted on blur to avoid a request per keystroke.
  const editLocal = (id, field, value) =>
    setMessages(ms => ms.map(m => m.id === id ? { ...m, [field]: value } : m))

  // Persist subject and body independently so the two blur events fired by one
  // tab-out (body → subject) touch disjoint fields and can't stomp each other.
  const persistSubject = (m) => patch({ upserts: [{ id: m.id, subject: m.subject }] })
  const persistBody = (m) => patch({ upserts: [{ id: m.id, bodyText: m.body_text, bodyHtml: nl2br(m.body_text) }] })

  const removeRow = (id) => patch({ deleteIds: [id] })

  const addRecipient = async () => {
    if (!addTenantId) return
    if (messages.some(m => m.tenant_id === addTenantId)) { setErrMsg(t.batchAlreadyAdded); return }
    const ok = await patch({ upserts: [{ tenantId: addTenantId }] })
    if (ok) setAddTenantId('')
  }

  // POST /api/email/batches/[id]/send — fires only from the confirm dialog.
  const send = async () => {
    setSending(true); setErrMsg(null)
    try {
      const res = await fetch(`/api/email/batches/${batch.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landlordId: user.id }),
      })
      const json = await res.json()
      setSending(false)
      if (!res.ok) { setErrMsg(json?.error || t.batchSendFailed); setConfirming(false); return }
      setResult({ sent: json.sent || 0, failed: json.failed || 0, skipped: json.skipped || 0 })
      setConfirming(false)
      setStep('result')
      refresh && refresh()
    } catch (e) { setSending(false); setErrMsg(e.message || t.batchSendFailed) }
  }

  const first = messages[0]
  const renderBody = (m) => m.body_html || nl2br(m.body_text)

  // Tenants not already in the batch, restricted to current/future like elsewhere.
  const inBatch = new Set(messages.map(m => m.tenant_id).filter(Boolean))
  const addOptions = [{ value: '', label: t.batchAddTenantPlaceholder },
    ...tenants.filter(x => isActiveTenant(x) && !inBatch.has(x.id))
      .map(x => ({ value: x.id, label: fullName(x) || t.batchNoName }))]

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <Modal title={automation.name} onClose={onClose}>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{t.batchLoading}</p>
      </Modal>
    )
  }
  if (step === 'error') {
    return (
      <Modal title={automation.name} onClose={onClose}>
        <p style={{ fontSize: 14, color: '#ef4444', margin: '0 0 16px' }}>{errMsg || t.batchLoadFailed}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="secondary" onClick={onClose}>{t.cancel}</Btn>
        </div>
      </Modal>
    )
  }

  // ── Result ──────────────────────────────────────────────────────────────────
  if (step === 'result') {
    return (
      <Modal title={t.batchResultTitle} onClose={onClose}>
        <p style={{ fontSize: 15, color: '#111111', margin: '0 0 8px', fontWeight: 600 }}>
          {t.batchResultSummary(result.sent, result.failed, result.skipped)}
        </p>
        <div style={footerRow}>
          <Btn onClick={onClose}>{t.batchDone}</Btn>
        </div>
      </Modal>
    )
  }

  // ── Step 1: preview (first recipient's rendered copy) ─────────────────────────
  if (step === 'preview') {
    if (!first) {
      return (
        <Modal title={automation.name} onClose={onClose}>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px' }}>{t.batchNoRecipients}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={onClose}>{t.cancel}</Btn>
          </div>
        </Modal>
      )
    }
    return (
      <Modal title={t.batchPreviewTitle} onClose={onClose} wide>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>{t.batchPreviewNote(tenantName(first.tenant_id))}</p>
        <div style={{ border: '1px solid #eaeaea', borderRadius: 9, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#fafafa', borderBottom: '1px solid #eaeaea', fontSize: 13, fontWeight: 600, color: '#111111' }}>{first.subject || t.batchPreviewNoSubject}</div>
          <div style={{ padding: '16px 14px', fontSize: 14, color: '#111111', minHeight: 160 }} dangerouslySetInnerHTML={{ __html: renderBody(first) }} />
        </div>
        <div style={footerRow}>
          <Btn variant="secondary" onClick={onClose}>{t.cancel}</Btn>
          <Btn onClick={() => setStep('review')}>{t.batchContinue}</Btn>
        </div>
      </Modal>
    )
  }

  // ── Step 2: review & edit + Step 3 confirm dialog ─────────────────────────────
  return (
    <Modal title={t.batchReviewTitle} onClose={onClose} wide>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>{t.batchReviewSubtitle}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 14px' }}>
        <span style={{ background: '#f3f4f6', color: '#111111', padding: '4px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600 }}>{t.batchRecipientCount(messages.length)}</span>
        {saving && <span style={{ fontSize: 12, color: '#9ca3af' }}>{t.batchSaving}</span>}
      </div>

      <div style={{ display: 'grid', gap: 12, maxHeight: '48vh', overflow: 'auto' }}>
        {messages.map(m => (
          <div key={m.id} style={{ border: '1px solid #eaeaea', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111111' }}>{tenantName(m.tenant_id)}</div>
                <div style={{ fontSize: 12, color: m.to_email ? '#6b7280' : '#ef4444' }}>{m.to_email || t.batchRecipientNoEmail}</div>
              </div>
              <Btn size="sm" variant="ghost" icon="trash" onClick={() => removeRow(m.id)}>{t.batchRemove}</Btn>
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', margin: '8px 0 4px' }}>{t.batchRecipientSubject}</label>
            <input value={m.subject || ''} onChange={e => editLocal(m.id, 'subject', e.target.value)} onBlur={() => persistSubject(m)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #eaeaea', borderRadius: 8, fontSize: 13, color: '#111111', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', margin: '10px 0 4px' }}>{t.batchRecipientBody}</label>
            <textarea value={m.body_text || ''} onChange={e => editLocal(m.id, 'body_text', e.target.value)}
              onBlur={() => persistBody(m)}
              style={{ width: '100%', minHeight: 120, padding: '10px 12px', border: '1px solid #eaeaea', borderRadius: 8, fontSize: 13, color: '#374151', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <Sel label={t.batchAddRecipient} value={addTenantId} onChange={setAddTenantId} options={addOptions} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Btn variant="secondary" icon="plus" onClick={addRecipient} disabled={!addTenantId || saving}>{t.batchAddRecipient}</Btn>
        </div>
      </div>

      {errMsg && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0 0' }}>{errMsg}</p>}

      <div style={footerRow}>
        <Btn variant="secondary" onClick={onClose}>{t.cancel}</Btn>
        <Btn onClick={() => { setErrMsg(null); setConfirming(true) }} disabled={messages.length === 0 || saving}>{t.batchSendEmails}</Btn>
      </div>

      {confirming && (
        <Modal title={t.batchConfirmTitle} onClose={() => !sending && setConfirming(false)}>
          <p style={{ fontSize: 14, color: '#374151', margin: '0 0 12px' }}>{t.batchConfirmBody(messages.length)}</p>
          <div style={{ maxHeight: '40vh', overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 9 }}>
            {messages.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderTop: '1px solid #fafafa', fontSize: 13 }}>
                <span style={{ color: '#111111', fontWeight: 600 }}>{tenantName(m.tenant_id)}</span>
                <span style={{ color: m.to_email ? '#6b7280' : '#ef4444' }}>{m.to_email || t.batchRecipientNoEmail}</span>
              </div>
            ))}
          </div>
          {errMsg && <p style={errText}>{errMsg}</p>}
          <div style={footerRow}>
            <Btn variant="secondary" onClick={() => setConfirming(false)} disabled={sending}>{t.cancel}</Btn>
            <Btn onClick={send} disabled={sending}>{sending ? t.batchSending : t.batchConfirmSend}</Btn>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

// ─── Automation editor modal ──────────────────────────────────────────────────
const AutomationEditor = ({ initial, data, user, t, onClose, onSaved }) => {
  const [name, setName] = useState(initial?.name || '')
  const [eventType, setEventType] = useState(initial?.eventType || 'move_out')
  const [offsets, setOffsets] = useState((initial?.offsetDays || [10, 5, 3]).join(', '))
  const [templateId, setTemplateId] = useState(initial?.templateId || '')
  const [propertyId, setPropertyId] = useState(initial?.scope?.propertyId || '')
  const [status, setStatus] = useState(initial?.scope?.status || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const parseOffsets = (s) => Array.from(new Set(String(s).split(/[,\s]+/).map(x => parseInt(x, 10)).filter(n => Number.isFinite(n) && n >= 0))).sort((a, b) => b - a)

  const templateOpts = [{ value: '', label: t.automationSelectTemplate }, ...(data.emailTemplates || []).map(x => ({ value: x.id, label: x.name }))]
  const propertyOpts = [{ value: '', label: t.scopeAllProperties }, ...(data.properties || []).map(p => ({ value: p.id, label: p.address }))]
  const statusOpts = [{ value: '', label: t.scopeAllStatuses }, { value: 'current tenant', label: t.statusCurrent }, { value: 'future tenant', label: t.statusFuture }]

  const save = async () => {
    const offsetDays = parseOffsets(offsets)
    if (!name.trim()) { setErr(t.automationNameRequired); return }
    if (!templateId) { setErr(t.automationTemplateRequired); return }
    if (!offsetDays.length) { setErr(t.automationOffsetsRequired); return }
    setSaving(true); setErr(null)
    const scope = (propertyId || status) ? { ...(propertyId ? { propertyId } : {}), ...(status ? { status } : {}) } : null
    const row = { landlord_id: user.id, name: name.trim(), event_type: eventType, offset_days: offsetDays, template_id: templateId, scope, updated_at: new Date().toISOString() }
    const res = initial?.id
      ? await supabase.from('email_automations').update(row).eq('id', initial.id)
      : await supabase.from('email_automations').insert({ ...row, enabled: false })
    setSaving(false)
    if (res.error) { setErr(res.error.message); return }
    onSaved()
  }

  return (
    <Modal title={initial?.id ? t.editAutomationTitle : t.newAutomation} onClose={onClose}>
      <Inp label={t.automationName} value={name} onChange={setName} placeholder={t.automationNamePlaceholder} />
      <Sel label={t.automationEvent} value={eventType} onChange={setEventType} options={EVENT_TYPES.map(e => ({ value: e.value, label: eventLabel(t, e.value) }))} />
      <Inp label={t.automationOffsets} value={offsets} onChange={setOffsets} placeholder="10, 5, 3" />
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '-6px 0 12px' }}>{t.automationOffsetsHint}</p>
      <Sel label={t.automationTemplate} value={templateId} onChange={setTemplateId} options={templateOpts} />
      <Sel label={t.automationScopeProperty} value={propertyId} onChange={setPropertyId} options={propertyOpts} />
      <Sel label={t.automationScopeStatus} value={status} onChange={setStatus} options={statusOpts} />
      {err && <p style={errText}>{err}</p>}
      <div style={footerRow}>
        <Btn variant="secondary" onClick={onClose}>{t.cancel}</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? t.saving : t.save}</Btn>
      </div>
    </Modal>
  )
}

// ─── Automations tab ──────────────────────────────────────────────────────────
const AutomationsTab = ({ data, user, t, refresh }) => {
  const [editing, setEditing] = useState(null)
  const [testing, setTesting] = useState(null)
  const [running, setRunning] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const automations = data.emailAutomations || []
  const templates = data.emailTemplates || []
  const tplName = (id) => templates.find(x => x.id === id)?.name || '—'

  const toggle = async (auto, enabled) => {
    await supabase.from('email_automations').update({ enabled }).eq('id', auto.id)
    refresh()
  }
  const del = async () => { await supabase.from('email_automations').delete().eq('id', confirmDel.id); setConfirmDel(null); refresh() }

  if (templates.length === 0) {
    return <div style={emptyCard}>{t.automationsNeedTemplate}</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Btn icon="plus" onClick={() => setEditing({})}>{t.newAutomation}</Btn>
      </div>
      {automations.length === 0 ? (
        <div style={emptyCard}>{t.noAutomations}</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {automations.map(a => (
            <div key={a.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111111' }}>{a.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {eventLabel(t, a.eventType)} · {t.offsetsLabel}: {(a.offsetDays || []).join(', ')} · {tplName(a.templateId)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <Btn size="sm" icon="mail" onClick={() => setRunning(a)}>{t.runNow}</Btn>
                <Btn size="sm" variant="secondary" icon="mail" onClick={() => setTesting(a)}>{t.sendTest}</Btn>
                <Btn size="sm" variant="ghost" icon="edit" onClick={() => setEditing(a)}>{t.edit}</Btn>
                <button onClick={() => setConfirmDel(a)} title={t.deleteAutomation} style={iconBtn}><Icon name="trash" size={16} /></button>
                <Toggle value={a.enabled} onChange={v => toggle(a, v)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <AutomationEditor initial={editing} data={data} user={user} t={t} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
      {testing && <TestSendModal template={{ id: testing.templateId }} eventType={testing.eventType} data={data} user={user} t={t} onClose={() => setTesting(null)} />}
      {running && <BatchSendModal automation={running} data={data} user={user} t={t} onClose={() => setRunning(null)} refresh={refresh} />}
      {confirmDel && (
        <Modal title={t.deleteAutomation} onClose={() => setConfirmDel(null)}>
          <p style={{ fontSize: 14, color: '#374151', margin: '0 0 20px' }}>{t.confirmDeleteAutomation} <strong>{confirmDel.name}</strong>?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setConfirmDel(null)}>{t.cancel}</Btn>
            <button onClick={del} style={dangerBtn}>{t.deleteAutomation}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Inbox / activity tab ─────────────────────────────────────────────────────
const STATUS_STYLE = {
  queued:     { bg: '#f5f5f5', text: '#9ca3af' },
  sent:       { bg: '#f3f4f6', text: '#000000' },
  delivered:  { bg: '#dcfce7', text: '#166534' },
  opened:     { bg: '#cffafe', text: '#155e75' },
  bounced:    { bg: '#fee2e2', text: '#991b1b' },
  complained: { bg: '#fee2e2', text: '#991b1b' },
  failed:     { bg: '#fee2e2', text: '#991b1b' },
  received:   { bg: '#dcfce7', text: '#166534' },
}
const StatusPill = ({ status, label }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.queued
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.text, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</span>
}

const InboxTab = ({ data, t }) => {
  const [expanded, setExpanded] = useState(null)
  const [showTests, setShowTests] = useState(false)
  const messages = data.emailMessages || []
  const tenants = data.tenants || []
  const tenantName = (id) => { const x = tenants.find(v => v.id === id); return x ? fullName(x) : '—' }
  const statusLabel = (s) => t[`st_${s}`] || s

  const outbound = messages.filter(m => m.direction === 'outbound' && (showTests || !m.isTest))
  const repliesFor = (id) => messages.filter(m => m.direction === 'inbound' && m.replyToMessageId === id)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Toggle value={showTests} onChange={setShowTests} />
        <span style={{ fontSize: 13, color: '#6b7280' }}>{t.inboxShowTests}</span>
      </div>
      {outbound.length === 0 ? (
        <div style={emptyCard}>{t.inboxEmpty}</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f5f5f5', overflow: 'hidden' }}>
          {outbound.map(m => {
            const replies = repliesFor(m.id)
            const open = expanded === m.id
            return (
              <div key={m.id} style={{ borderTop: '1px solid #fafafa' }}>
                <div onClick={() => setExpanded(open ? null : m.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.subject || '—'} {m.isTest && <span style={{ fontSize: 11, color: '#9ca3af' }}>· {t.inboxTestTag}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{tenantName(m.tenantId)} · {m.toEmail} · {fmtDate((m.createdAt || '').split('T')[0])}</div>
                  </div>
                  {m.repliedAt && <StatusPill status="received" label={t.inboxReplied} />}
                  {!m.repliedAt && m.openedAt && <StatusPill status="opened" label={t.inboxOpened} />}
                  <StatusPill status={m.status} label={statusLabel(m.status)} />
                </div>
                {open && (
                  <div style={{ padding: '0 20px 18px', background: '#fafbfc' }}>
                    <div style={{ border: '1px solid #eef2f7', borderRadius: 9, padding: 14, background: '#fff', fontSize: 13, color: '#334155' }}
                      dangerouslySetInnerHTML={{ __html: m.bodyHtml || (m.bodyText ? m.bodyText.replace(/\n/g, '<br>') : `<span style="color:#9ca3af">${t.inboxNoBody}</span>`) }} />
                    {replies.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>{t.inboxReplyThread}</div>
                        {replies.map(r => (
                          <div key={r.id} style={{ borderLeft: '3px solid #111111', padding: '8px 12px', marginBottom: 8, background: '#fff', borderRadius: 6 }}>
                            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{r.toEmail} · {fmtDate((r.createdAt || '').split('T')[0])}</div>
                            {/* Inbound bodies come from external senders — render as plain text, never raw HTML (XSS). */}
                            <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap' }}>{r.bodyText || stripTags(r.bodyHtml) || ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────
export const EmailAutomationPage = ({ data, user, t, refresh }) => {
  const [tab, setTab] = useState('templates')
  const tabs = [
    { id: 'templates', label: t.tabTemplates },
    { id: 'generator', label: t.tabEmailGenerator },
    { id: 'automations', label: t.tabAutomations },
    { id: 'inbox', label: t.tabInbox },
  ]
  return (
    <div>
      <PageHeader title={t.emailAutoTitle} subtitle={t.emailAutoSubtitle} />
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #eaeaea', marginBottom: 22 }}>
        {tabs.map(x => (
          <button key={x.id} onClick={() => setTab(x.id)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: tab === x.id ? '2px solid #111111' : '2px solid transparent', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: tab === x.id ? 600 : 400, color: tab === x.id ? '#111111' : '#6b7280' }}>
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'templates' && <TemplatesTab data={data} user={user} t={t} refresh={refresh} />}
      {tab === 'generator' && <EmailGeneratorTab data={data} t={t} />}
      {tab === 'automations' && <AutomationsTab data={data} user={user} t={t} refresh={refresh} />}
      {tab === 'inbox' && <InboxTab data={data} t={t} />}
    </div>
  )
}
