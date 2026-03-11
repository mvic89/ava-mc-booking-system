'use client'

import { useState, useMemo } from 'react'
import { useInventory } from '@/context/InventoryContext'
import type { InventoryCategory, MCType, Warehouse } from '@/utils/types'

// ─── ID generator ─────────────────────────────────────────────────────────────

function generateNextId(type: InventoryCategory, existingIds: string[]): string {
    const prefix = type === 'motorcycles' ? 'MC' : type === 'spareParts' ? 'SP' : 'ACC'
    const nums = existingIds
        .filter((id) => id.startsWith(prefix + '-'))
        .map((id) => parseInt(id.replace(prefix + '-', ''), 10))
        .filter((n) => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${prefix}-${String(next).padStart(3, '0')}`
}

// ─── Reusable field components ────────────────────────────────────────────────

function Field({
    label, required, children,
}: {
    label: string; required?: boolean; children: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {label}{required && <span className="text-orange-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent'
const selectCls = inputCls + ' bg-white'

// ─── Type cards ───────────────────────────────────────────────────────────────

const ITEM_TYPES: { id: InventoryCategory; label: string; icon: string; color: string }[] = [
    { id: 'motorcycles', label: 'Motorcycle',  icon: '🏍️', color: 'border-orange-400 bg-orange-50 text-orange-700' },
    { id: 'spareParts',  label: 'Spare Part',  icon: '🔧', color: 'border-blue-400  bg-blue-50  text-blue-700'   },
    { id: 'accessories', label: 'Accessory',   icon: '🪖', color: 'border-purple-400 bg-purple-50 text-purple-700' },
]

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</span>
            <div className="flex-1 h-px bg-gray-100" />
        </div>
    )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AddItemModal({ onClose }: { onClose: () => void }) {
    const { motorcycles, spareParts, accessories, addItem } = useInventory()

    const [type, setType] = useState<InventoryCategory | ''>('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Common fields
    const [articleNumber, setArticleNumber] = useState('')
    const [name, setName]                   = useState('')
    const [brand, setBrand]                 = useState('')
    const [description, setDescription]     = useState('')
    const [stock, setStock]                 = useState('')
    const [reorderQty, setReorderQty]       = useState('')
    const [cost, setCost]                   = useState('')
    const [sellingPrice, setSellingPrice]   = useState('')
    const [vendor, setVendor]               = useState('')

    // Motorcycle-specific
    const [vin, setVin]           = useState('')
    const [engineCC, setEngineCC] = useState('')
    const [color, setColor]       = useState('')
    const [year, setYear]         = useState(String(new Date().getFullYear()))
    const [mcType, setMcType]     = useState<MCType>('New')
    const [warehouse, setWarehouse] = useState<Warehouse>('Warehouse A')

    // Spare part-specific
    const [spCategory, setSpCategory] = useState('')

    // Accessory-specific
    const [accCategory, setAccCategory] = useState('')
    const [size, setSize]               = useState('')

    // Auto-generate item ID when type is chosen
    const autoId = useMemo(() => {
        if (!type) return ''
        const existingIds =
            type === 'motorcycles' ? motorcycles.map((m) => m.id) :
            type === 'spareParts'  ? spareParts.map((s) => s.id)  :
                                     accessories.map((a) => a.id)
        return generateNextId(type, existingIds)
    }, [type, motorcycles, spareParts, accessories])

    const typeLabel =
        type === 'motorcycles' ? 'Motorcycle' :
        type === 'spareParts'  ? 'Spare Part' :
        type === 'accessories' ? 'Accessory'  : ''

    const canSubmit =
        type &&
        name.trim() &&
        articleNumber.trim() &&
        stock !== '' &&
        cost !== '' &&
        sellingPrice !== '' &&
        (type !== 'motorcycles' || vin.trim()) &&
        (type !== 'spareParts'  || spCategory) &&
        (type !== 'accessories' || accCategory)

    async function handleSubmit() {
        if (!canSubmit || !type) return
        setSaving(true)
        setError('')
        try {
            if (type === 'motorcycles') {
                await addItem('motorcycles', {
                    id: autoId, articleNumber: articleNumber.trim(),
                    name: name.trim(), brand: brand.trim(),
                    description: description.trim(),
                    stock: parseInt(stock) || 0,
                    reorderQty: parseInt(reorderQty) || 0,
                    cost: parseFloat(cost) || 0,
                    sellingPrice: parseFloat(sellingPrice) || 0,
                    vendor: vendor.trim(),
                    vin: vin.trim(),
                    engineCC: parseInt(engineCC) || 0,
                    color: color.trim(),
                    year: parseInt(year) || new Date().getFullYear(),
                    mcType,
                    warehouse,
                })
            } else if (type === 'spareParts') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await addItem('spareParts', {
                    id: autoId, articleNumber: articleNumber.trim(),
                    name: name.trim(), brand: brand.trim(),
                    description: description.trim(),
                    stock: parseInt(stock) || 0,
                    reorderQty: parseInt(reorderQty) || 0,
                    cost: parseFloat(cost) || 0,
                    sellingPrice: parseFloat(sellingPrice) || 0,
                    vendor: vendor.trim(),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    category: spCategory as any,
                })
            } else {
                await addItem('accessories', {
                    id: autoId, articleNumber: articleNumber.trim(),
                    name: name.trim(), brand: brand.trim(),
                    description: description.trim(),
                    stock: parseInt(stock) || 0,
                    reorderQty: parseInt(reorderQty) || 0,
                    cost: parseFloat(cost) || 0,
                    sellingPrice: parseFloat(sellingPrice) || 0,
                    vendor: vendor.trim(),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    category: accCategory as any,
                    size: size.trim() || undefined,
                })
            }
            onClose()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save item')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                            New Inventory Item
                        </p>
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl font-bold text-gray-900 font-mono">
                                {autoId || '— — —'}
                            </span>
                            {autoId && (
                                <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full font-semibold">
                                    Auto ID · {typeLabel}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Scrollable body ─────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

                    {/* Type selection */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                            Select Item Type <span className="text-orange-500">*</span>
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {ITEM_TYPES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setType(t.id)}
                                    className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                                        type === t.id
                                            ? t.color + ' shadow-sm'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-2xl">{t.icon}</span>
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fields appear after type is selected */}
                    {type && (
                        <>
                            {/* ── Basic info ── */}
                            <Section title="Basic Info" />
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Item Name" required>
                                    <input className={inputCls} placeholder="e.g. Yamaha R15" value={name} onChange={(e) => setName(e.target.value)} />
                                </Field>
                                <Field label="Brand">
                                    <input className={inputCls} placeholder="e.g. Yamaha" value={brand} onChange={(e) => setBrand(e.target.value)} />
                                </Field>
                                <Field label="Article Number" required>
                                    <input className={inputCls} placeholder="e.g. ART-00123" value={articleNumber} onChange={(e) => setArticleNumber(e.target.value)} />
                                </Field>
                                <Field label="Vendor / Supplier">
                                    <input className={inputCls} placeholder="e.g. Moto Supplies AB" value={vendor} onChange={(e) => setVendor(e.target.value)} />
                                </Field>
                            </div>
                            <Field label="Description">
                                <textarea
                                    className={inputCls + ' resize-none'}
                                    rows={2}
                                    placeholder="Short description of this item…"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </Field>

                            {/* ── Pricing & Stock ── */}
                            <Section title="Pricing & Stock" />
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Stock (units)" required>
                                    <input className={inputCls} type="number" min="0" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
                                </Field>
                                <Field label="Reorder Qty">
                                    <input className={inputCls} type="number" min="0" placeholder="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
                                </Field>
                                <Field label="Cost (SEK)" required>
                                    <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
                                </Field>
                                <Field label="Selling Price (SEK)" required>
                                    <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
                                </Field>
                            </div>

                            {/* ── Motorcycle-specific ── */}
                            {type === 'motorcycles' && (
                                <>
                                    <Section title="Motorcycle Details" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="VIN / Chassis No." required>
                                            <input className={inputCls} placeholder="e.g. ME4RG3227P8000001" value={vin} onChange={(e) => setVin(e.target.value)} />
                                        </Field>
                                        <Field label="Engine CC">
                                            <input className={inputCls} type="number" min="0" placeholder="e.g. 155" value={engineCC} onChange={(e) => setEngineCC(e.target.value)} />
                                        </Field>
                                        <Field label="Color">
                                            <input className={inputCls} placeholder="e.g. Midnight Black" value={color} onChange={(e) => setColor(e.target.value)} />
                                        </Field>
                                        <Field label="Year">
                                            <input className={inputCls} type="number" min="1990" max="2099" placeholder="2025" value={year} onChange={(e) => setYear(e.target.value)} />
                                        </Field>
                                        <Field label="MC Type">
                                            <select className={selectCls} value={mcType} onChange={(e) => setMcType(e.target.value as MCType)}>
                                                <option value="New">New</option>
                                                <option value="Trade-In">Trade-In</option>
                                                <option value="Commission">Commission</option>
                                            </select>
                                        </Field>
                                        <Field label="Warehouse">
                                            <select className={selectCls} value={warehouse} onChange={(e) => setWarehouse(e.target.value as Warehouse)}>
                                                <option>Warehouse A</option>
                                                <option>Warehouse B</option>
                                                <option>Warehouse C</option>
                                                <option>Warehouse D</option>
                                            </select>
                                        </Field>
                                    </div>
                                </>
                            )}

                            {/* ── Spare Part-specific ── */}
                            {type === 'spareParts' && (
                                <>
                                    <Section title="Spare Part Details" />
                                    <Field label="Category" required>
                                        <select className={selectCls} value={spCategory} onChange={(e) => setSpCategory(e.target.value)}>
                                            <option value="">— Select category —</option>
                                            <option>Engine</option>
                                            <option>Brakes</option>
                                            <option>Electrical</option>
                                            <option>Transmission</option>
                                            <option>Suspension</option>
                                            <option>Fuel System</option>
                                            <option>Tyres &amp; Wheels</option>
                                            <option>Exhaust</option>
                                            <option>Body &amp; Frame</option>
                                        </select>
                                    </Field>
                                </>
                            )}

                            {/* ── Accessory-specific ── */}
                            {type === 'accessories' && (
                                <>
                                    <Section title="Accessory Details" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Category" required>
                                            <select className={selectCls} value={accCategory} onChange={(e) => setAccCategory(e.target.value)}>
                                                <option value="">— Select category —</option>
                                                <option>Helmet</option>
                                                <option>Gloves</option>
                                                <option>Jacket</option>
                                                <option>Boots</option>
                                                <option>Pants</option>
                                                <option>Protection</option>
                                                <option>Luggage</option>
                                                <option>Handlebars &amp; Grips</option>
                                                <option>Cap</option>
                                                <option>Neck &amp; Face</option>
                                            </select>
                                        </Field>
                                        <Field label="Size">
                                            <input className={inputCls} placeholder="e.g. M, L, XL or 42" value={size} onChange={(e) => setSize(e.target.value)} />
                                        </Field>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                            {error}
                        </p>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        {autoId
                            ? <>ID <span className="font-semibold text-gray-600">{autoId}</span> auto-assigned</>
                            : 'Select a type to auto-assign an ID'}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit || saving}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            {saving ? 'Adding…' : '+ Add Item'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
