'use client'

import { useState, useRef } from 'react'

interface ExtractedDeliveryNote {
  vendor:               string | null
  delivery_note_number: string | null
  received_date:        string | null
  po_reference:         string | null
  notes:                string | null
  items: {
    article_number: string | null
    name:           string
    ordered_qty:    number | null
    received_qty:   number
    unit_cost:      number | null
  }[]
}

export default function TestDeliveryExtractPage() {
  const [result,  setResult]  = useState<ExtractedDeliveryNote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleTest() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Select a PDF first'); return }
    setLoading(true); setError(null); setResult(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      try {
        const res  = await fetch('/api/goods-receipt/test', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ pdf_base64: base64 }),
        })
        const data = await res.json()
        if (!res.ok) { setError(JSON.stringify(data)); return }
        setResult(data.extracted)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="lg:ml-64 min-h-screen p-8 bg-white">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Delivery Note PDF Extraction Test</h1>
      <p className="text-sm text-gray-400 mb-6">Upload a supplier delivery note PDF — Claude AI extracts the data. No DB writes.</p>

      <div className="flex items-center gap-4 mb-6">
        <input ref={fileRef} type="file" accept="application/pdf"
          className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
        <button onClick={handleTest} disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
          {loading ? 'Extracting…' : 'Test Extraction'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Header fields */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Extracted Fields</p>
            </div>
            <div className="divide-y divide-gray-100">
              {([
                ['Vendor',               result.vendor],
                ['Delivery Note #',      result.delivery_note_number],
                ['Received Date',        result.received_date],
                ['PO Reference',         result.po_reference],
                ['Notes',                result.notes],
              ] as [string, string | null][]).map(([label, value]) => (
                <div key={label} className="flex items-center px-5 py-3 gap-4">
                  <p className="text-xs font-semibold text-gray-500 w-40 shrink-0">{label}</p>
                  <p className={`text-sm font-mono ${!value ? 'text-red-500' : 'text-gray-900 font-semibold'}`}>
                    {value ?? '— not found'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          {result.items.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Delivered Items ({result.items.length})</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Art #</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-500">Ordered</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-500">Received</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800">{item.name}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-400">{item.article_number ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500">{item.ordered_qty ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-gray-900">{item.received_qty}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{item.unit_cost ? item.unit_cost.toLocaleString('sv-SE') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700">
              No line items extracted.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
