'use client'
import { useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Inp, Sel, Btn, Badge, Icon, PageHeader } from './property-management-app'
import { MERGE_TAGS, renderTemplate, buildContext, sampleContext } from '@/lib/email/merge'
import { EVENT_TYPES } from '@/lib/email/events'
import { fmtDate } from '@/lib/email/format'

const supabase = createClient()

const card = { background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #f5f5f5' }

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
const MergeTagBar = ({ onInsert, t }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
    <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center', marginRight: 4 }}>{t.insertField}:</span>
    {MERGE_TAGS.map(m => (
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
          {err && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
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
    ...(data.tenants || []).filter(x => x.status === 'current tenant' || x.status === 'future tenant')
      .map(x => ({ value: x.id, label: [x.name, x.lastName].filter(Boolean).join(' ') }))]

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
      {result?.error && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{result.error}</p>}
      {result?.ok && <p style={{ color: '#22c55e', fontSize: 13, margin: '8px 0 0' }}>{t.testSent}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
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
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>{t.noTemplates}</div>
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
                <button onClick={() => setConfirmDel(tpl)} title={t.deleteTemplate}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 6, display: 'inline-flex' }}>
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
            <button onClick={del} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>{t.deleteTemplate}</button>
          </div>
        </Modal>
      )}
    </div>
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
      {err && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
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
    return <div style={{ ...card, textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>{t.automationsNeedTemplate}</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Btn icon="plus" onClick={() => setEditing({})}>{t.newAutomation}</Btn>
      </div>
      {automations.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>{t.noAutomations}</div>
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
                <Btn size="sm" variant="secondary" icon="mail" onClick={() => setTesting(a)}>{t.sendTest}</Btn>
                <Btn size="sm" variant="ghost" icon="edit" onClick={() => setEditing(a)}>{t.edit}</Btn>
                <button onClick={() => setConfirmDel(a)} title={t.deleteAutomation} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 6, display: 'inline-flex' }}><Icon name="trash" size={16} /></button>
                <Toggle value={a.enabled} onChange={v => toggle(a, v)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <AutomationEditor initial={editing} data={data} user={user} t={t} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
      {testing && <TestSendModal template={{ id: testing.templateId }} eventType={testing.eventType} data={data} user={user} t={t} onClose={() => setTesting(null)} />}
      {confirmDel && (
        <Modal title={t.deleteAutomation} onClose={() => setConfirmDel(null)}>
          <p style={{ fontSize: 14, color: '#374151', margin: '0 0 20px' }}>{t.confirmDeleteAutomation} <strong>{confirmDel.name}</strong>?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setConfirmDel(null)}>{t.cancel}</Btn>
            <button onClick={del} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>{t.deleteAutomation}</button>
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
  const tenantName = (id) => { const x = tenants.find(v => v.id === id); return x ? [x.name, x.lastName].filter(Boolean).join(' ') : '—' }
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
        <div style={{ ...card, textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40 }}>{t.inboxEmpty}</div>
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
      {tab === 'automations' && <AutomationsTab data={data} user={user} t={t} refresh={refresh} />}
      {tab === 'inbox' && <InboxTab data={data} t={t} />}
    </div>
  )
}
