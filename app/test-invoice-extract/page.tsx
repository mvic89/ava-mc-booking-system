'use client'

import { useState, useRef } from 'react'

interface ExtractedInvoice {
  supplier_name:           string | null
  supplier_invoice_number: string | null
  po_reference:            string | null
  po_references:           string[]
  invoice_date:            string | null
  due_date:                string | null
  amount:                  number
  currency:                string
  lineItems: {
    article_number:   string | null
    description:      string
    qty:              number
    gross_unit_price: number
    discount_pct:     number
    discount_amount:  number
    unit_price:       number
    line_total:       number
    vin:              string | null
    po_reference:     string | null
  }[]
}

export default function TestInvoiceExtractPage() {
  const [result,  setResult]  = useState<ExtractedInvoice | null>(null)
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
        const res  = await fetch('/api/purchase-invoice/process', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ dry_run: true, pdf_base64: base64 }),
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

  const missing = (v: string | null | number) =>
    v === null || v === 0 || v === ''

  return (
    <div className="lg:ml-64 min-h-screen p-8 bg-white">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Invoice PDF Extraction Test</h1>
      <p className="text-sm text-gray-400 mb-6">Upload a supplier invoice PDF — Claude AI extracts the data. No email sent, no DB writes.</p>

      <div className="flex items-center gap-4 mb-6">
        <input ref={fileRef} type="file" accept="application/pdf"
          className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
        <button onClick={handleTest} disabled={loading}
          className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
          {loading ? 'Extracting…' : 'Test Extraction'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Extracted fields */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Extracted Fields</p>
            </div>
            <div className="divide-y divide-gray-100">
              {([
                ['Supplier Name',      result.supplier_name],
                ['Supplier Invoice #', result.supplier_invoice_number],
                ['PO Reference',       result.po_references?.length > 1
                    ? result.po_references.join(', ')
                    : result.po_reference],
                ['Invoice Date',       result.invoice_date],
                ['Due Date',           result.due_date],
                ['Amount',             result.amount > 0 ? `${result.amount.toLocaleString('sv-SE')} ${result.currency}` : null],
                ['Currency',           result.currency],
              ] as [string, string | null][]).map(([label, value]) => (
                <div key={label} className="flex items-center px-5 py-3 gap-4">
                  <p className="text-xs font-semibold text-gray-500 w-40 shrink-0">{label}</p>
                  <p className={`text-sm font-mono ${missing(value) ? 'text-red-500' : 'text-gray-900 font-semibold'}`}>
                    {value ?? '— not found'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          {result.lineItems.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Line Items ({result.lineItems.length})</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">Art #</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">VIN</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-500">PO Ref</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">Gross Price</th>
                    <th className="px-4 py-2 text-right font-semibold text-red-400">Discount %</th>
                    <th className="px-4 py-2 text-right font-semibold text-red-400">Discount</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-500">Net Price</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.lineItems.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800">{item.description}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-400">{item.article_number ?? '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{item.vin ?? '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-purple-600">{item.po_reference ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{item.qty}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 line-through">{item.gross_unit_price > 0 ? item.gross_unit_price.toLocaleString('sv-SE') : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-red-500">{item.discount_amount > 0 ? `-${item.discount_amount.toLocaleString('sv-SE')}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{item.unit_price > 0 ? item.unit_price.toLocaleString('sv-SE') : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-900">{item.line_total.toLocaleString('sv-SE')}</td>
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
