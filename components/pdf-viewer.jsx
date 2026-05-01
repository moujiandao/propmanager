'use client'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PdfViewer({ url }) {
  const [numPages, setNumPages] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState(null)

  const width = typeof window !== 'undefined' ? Math.min(window.innerWidth - 80, 820) : 700

  if (error) {
    return (
      <div style={{ padding: 24, color: '#ef4444', fontSize: 14 }}>
        Failed to load PDF. The document may have moved or access may have expired.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPage(1); }}
        onLoadError={() => setError(true)}
        loading={<div style={{ padding: 32, color: '#94a3b8', fontSize: 14 }}>Loading PDF…</div>}
      >
        <Page pageNumber={page} width={width} />
      </Document>
      {numPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 13, color: '#374151' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}
          >‹ Prev</button>
          <span>{page} / {numPages}</span>
          <button
            onClick={() => setPage(p => Math.min(numPages, p + 1))}
            disabled={page === numPages}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: page === numPages ? 'default' : 'pointer', opacity: page === numPages ? 0.4 : 1, fontSize: 13 }}
          >Next ›</button>
        </div>
      )}
    </div>
  )
}
