'use client'

import { useState } from 'react'
import { useInventory } from '@/context/InventoryContext'
import {
    Motorcycle, SparePart, Accessory, BaseInventoryItem,
    InventoryCategory, MCType, Warehouse,
} from '@/utils/types'

const MC_TYPES:    MCType[]    = ['New', 'Trade-In', 'Commission']
const WAREHOUSES:  Warehouse[] = ['Warehouse A', 'Warehouse B', 'Warehouse C', 'Warehouse D']
const SP_CATS = ['Engine', 'Brakes', 'Electrical', 'Transmission', 'Suspension', 'Fuel System', 'Tyres & Wheels', 'Exhaust', 'Body & Frame']
const ACC_CATS = ['Helmet', 'Gloves', 'Jacket', 'T-Shirt', 'Boots', 'Pants', 'Protection', 'Luggage', 'Seat Cover', 'Handlebars & Grips', 'Cap', 'Neck & Face']

const ACC_STYLES: Record<string, string[]> = {
    'Helmet': [
        'Open Face', 'Full Face', 'Modular / Flip-Up', 'Off-Road / Motocross',
        'Half Shell', 'Dual Sport', 'Enduro', 'Trial',
    ],
    'Gloves': [
        'Fingerless / Mitts', 'Short Cuff Summer', 'Full Finger Mid-Season',
        'Full Gauntlet Winter', 'Hard Knuckle', 'Racing / Track Day',
        'Touring', 'Off-Road / Motocross', 'Urban / Street',
        'Heated', 'Waterproof', 'Adventure / ADV',
    ],
    'Jacket': [
        'Leather Racing', 'Leather Touring', 'Leather Urban',
        'Textile Sport', 'Textile Touring', 'Textile Adventure',
        'Mesh / Summer', 'Softshell', 'Waterproof / Rain',
        'Winter / Insulated', 'Urban / Casual', 'High-Vis',
    ],
    'Boots': [
        'Racing / Track', 'Sports Touring', 'Touring',
        'Adventure / ADV', 'Off-Road / Motocross', 'Urban / Street',
        'Short / Ankle', 'Waterproof Touring', 'Cruiser',
    ],
    'Pants': [
        'Leather Racing', 'Leather Touring',
        'Textile Sport', 'Textile Touring', 'Textile Adventure',
        'Mesh / Summer', 'Waterproof / Rain', 'Denim / Jeans',
        'Overpants', 'Off-Road',
    ],
    'T-Shirt': [
        'Men Crew Neck', 'Women Fitted', 'Unisex',
        'Polo', 'Long Sleeve', 'Compression Base Layer',
    ],
    'Cap': [
        'Baseball Cap Men', 'Baseball Cap Women', 'Snapback',
        'Beanie', 'Bucket Hat', 'Flat Cap', 'Trucker Cap',
    ],
    'Neck & Face': [
        'Full Balaclava', 'Open Face Balaclava', 'Lightweight Balaclava',
        'Neck Tube / Buff', 'Face Mask / Gaiter', 'Windproof Mask', 'Scarf',
    ],
    'Seat Cover': [
        'OEM Replacement', 'Custom Fit', 'Gel Padded',
        'Memory Foam', 'Heated', 'Anti-Slip / Grippy',
        'Sheepskin', 'Waterproof',
    ],
    'Protection': [
        'Back Protector Level 1', 'Back Protector Level 2',
        'Chest Protector', 'Knee Guard Soft', 'Knee Guard Hard Shell',
        'Elbow Guard', 'Hip Guard', 'Shoulder Pad',
        'Spine Protector', 'Neck Brace', 'Airbag Vest', 'Full Body Armor',
    ],
    'Luggage': [
        'Tank Bag Magnetic', 'Tank Bag Strap-On', 'Tail Bag / Seat Bag',
        'Hard Pannier', 'Soft Saddlebag', 'Backpack',
        'Dry Bag', 'Top Case Liner', 'Handlebar Bag',
        'Roll Bag', 'Cargo Net',
    ],
    'Handlebars & Grips': [
        'Standard Grip', 'Ergonomic Grip', 'Heated Grip', 'Lock-On Grip',
        'Bar End Weight', 'Riser / Adapter', 'Clip-On / Clubman',
        'Fatbar', 'Crossbar Pad', 'Throttle Assist',
    ],
}

function formatSEK(v: number) {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(v)
}

interface Props {
    item:     Motorcycle | SparePart | Accessory
    category: InventoryCategory
    onClose:  () => void
}

export function EditItemModal({ item, category, onClose }: Props) {
    const { updateItem, deleteItem } = useInventory()

    // initialise form from item
    const [form, setForm] = useState({
        name:          item.name,
        brand:         item.brand,
        articleNumber: item.articleNumber,
        description:   item.description,
        stock:         String(item.stock),
        reorderQty:    String(item.reorderQty),
        cost:          String(item.cost),
        sellingPrice:  String(item.sellingPrice),
        vendor:        item.vendor,
        // motorcycle-specific
        vin:       (item as Motorcycle).vin       ?? '',
        year:      String((item as Motorcycle).year      ?? ''),
        engineCC:  String((item as Motorcycle).engineCC  ?? ''),
        color:     (item as Motorcycle).color     ?? '',
        mcType:    (item as Motorcycle).mcType    ?? 'New',
        warehouse: (item as Motorcycle).warehouse ?? 'Warehouse A',
        // spare-part / accessory category
        category:  (item as SparePart | Accessory).category ?? '',
        // accessory sub-group, size, and colour
        subGroup:  (item as Accessory).subGroup ?? '',
        size:      (item as Accessory).size ?? '',
        accColor:  (item as Accessory).color ?? '',
        // shared optional
        location:  item.location ?? '',
    })

    const [saving,  setSaving]  = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [saved,   setSaved]   = useState(false)
    const [error,   setError]   = useState('')

    function set(field: string, value: string) {
        setForm(f => ({ ...f, [field]: value }))
        setSaved(false)
        setError('')
    }

    async function handleSave() {
        setSaving(true)
        setError('')
        try {
            const base: BaseInventoryItem = {
                id:            item.id,
                name:          form.name.trim(),
                brand:         form.brand.trim(),
                articleNumber: form.articleNumber.trim(),
                description:   form.description.trim(),
                stock:         parseInt(form.stock)         || 0,
                reorderQty:    parseInt(form.reorderQty)    || 0,
                cost:          parseFloat(form.cost)        || 0,
                sellingPrice:  parseFloat(form.sellingPrice)|| 0,
                vendor:        form.vendor.trim(),
                location:      form.location.trim() || undefined,
            }

            if (category === 'motorcycles') {
                await updateItem('motorcycles', {
                    ...base,
                    vin:       form.vin.trim(),
                    year:      parseInt(form.year)    || 0,
                    engineCC:  parseInt(form.engineCC)|| 0,
                    color:     form.color.trim(),
                    mcType:    form.mcType as MCType,
                    warehouse: form.warehouse as Warehouse,
                } as Motorcycle)
            } else if (category === 'spareParts') {
                await updateItem('spareParts', { ...base, category: form.category } as SparePart)
            } else {
                await updateItem('accessories', {
                    ...base,
                    category: form.category,
                    subGroup: form.subGroup.trim() || undefined,
                    size:     form.size.trim() || undefined,
                    color:    form.accColor.trim() || undefined,
                } as Accessory)
            }
            setSaved(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!confirm(`Delete "${item.name}" permanently? This cannot be undone.`)) return
        setDeleting(true)
        await deleteItem(item.id)
        onClose()
    }

    const margin = form.sellingPrice && form.cost
        ? (((parseFloat(form.sellingPrice) - parseFloat(form.cost)) / parseFloat(form.sellingPrice)) * 100).toFixed(1)
        : '0.0'

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                            {category === 'motorcycles' ? '🏍️ Motorcycle' : category === 'spareParts' ? '🔧 Spare Part' : '🪖 Accessory'}
                            {' · '}<span className="font-mono">{item.id}</span>
                        </p>
                        <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
                        <p className="text-xs text-orange-500 font-medium">{item.brand}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0"
                    >✕</button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Pricing summary strip */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Cost',       value: formatSEK(parseFloat(form.cost) || 0),         color: 'bg-gray-50' },
                            { label: 'Sell Price', value: formatSEK(parseFloat(form.sellingPrice) || 0), color: 'bg-orange-50' },
                            { label: 'Margin',     value: `${margin}%`,                                  color: 'bg-green-50' },
                        ].map(c => (
                            <div key={c.label} className={`${c.color} rounded-xl p-3 text-center`}>
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{c.label}</p>
                                <p className="text-base font-bold text-gray-800 mt-0.5">{c.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Core fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Name *" value={form.name} onChange={v => set('name', v)} />
                        <Field label="Brand *" value={form.brand} onChange={v => set('brand', v)} />
                        <Field label="Article Number" value={form.articleNumber} onChange={v => set('articleNumber', v)} mono />
                        <Field label="Vendor / Supplier" value={form.vendor} onChange={v => set('vendor', v)} />
                        <Field label="Location" value={form.location} onChange={v => set('location', v)} placeholder="e.g. B3-12" />
                    </div>
                    <Field label="Description" value={form.description} onChange={v => set('description', v)} multiline />

                    {/* Stock */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Stock" value={form.stock} onChange={v => set('stock', v)} type="number" />
                        <Field label="Reorder Qty" value={form.reorderQty} onChange={v => set('reorderQty', v)} type="number" />
                        <Field label="Cost (SEK)" value={form.cost} onChange={v => set('cost', v)} type="number" />
                        <Field label="Sell Price (SEK)" value={form.sellingPrice} onChange={v => set('sellingPrice', v)} type="number" />
                    </div>

                    {/* Motorcycle-specific */}
                    {category === 'motorcycles' && (
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="VIN" value={form.vin} onChange={v => set('vin', v)} mono />
                            <Field label="Year" value={form.year} onChange={v => set('year', v)} type="number" />
                            <Field label="Engine CC" value={form.engineCC} onChange={v => set('engineCC', v)} type="number" />
                            <Field label="Color" value={form.color} onChange={v => set('color', v)} />
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">MC Type</label>
                                <select value={form.mcType} onChange={e => set('mcType', e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400">
                                    {MC_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Warehouse</label>
                                <select value={form.warehouse} onChange={e => set('warehouse', e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400">
                                    {WAREHOUSES.map(w => <option key={w}>{w}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Spare-part / accessory category */}
                    {(category === 'spareParts' || category === 'accessories') && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
                                <select value={form.category}
                                    onChange={e => { set('category', e.target.value); set('subGroup', '') }}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400">
                                    {category === 'spareParts'
                                        ? SP_CATS.map(c => <option key={c}>{c}</option>)
                                        : (
                                            <>
                                                <optgroup label="Helmets"><option>Helmet</option></optgroup>
                                                <optgroup label="Clothing">
                                                    {['Jacket', 'Gloves', 'T-Shirt', 'Pants', 'Boots', 'Cap', 'Neck & Face'].map(c => <option key={c}>{c}</option>)}
                                                </optgroup>
                                                <optgroup label="Other">
                                                    {['Seat Cover', 'Protection', 'Luggage', 'Handlebars & Grips'].map(c => <option key={c}>{c}</option>)}
                                                </optgroup>
                                            </>
                                        )
                                    }
                                </select>
                            </div>
                            {category === 'accessories' && (
                                <Field label="Size (optional)" value={form.size} onChange={v => set('size', v)} placeholder="e.g. M, L, XL" />
                            )}
                            {category === 'accessories' && (
                                <Field label="Colour" value={form.accColor} onChange={v => set('accColor', v)} placeholder="e.g. Black, Midnight Blue" />
                            )}
                            {category === 'accessories' && ACC_STYLES[form.category] && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Style</label>
                                    <select value={form.subGroup} onChange={e => set('subGroup', e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400">
                                        <option value="">— Select style —</option>
                                        {ACC_STYLES[form.category].map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {deleting ? 'Deleting…' : '🗑️ Delete Item'}
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.name}
                            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                        >
                            {saving ? (
                                <><span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                            ) : saved ? '✓ Saved!' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Small reusable field ──────────────────────────────────────────────────────

function Field({
    label, value, onChange, type = 'text', mono = false,
    multiline = false, placeholder,
}: {
    label: string; value: string; onChange: (v: string) => void
    type?: string; mono?: boolean; multiline?: boolean; placeholder?: string
}) {
    const cls = `w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition ${mono ? 'font-mono' : ''}`
    return (
        <div className={multiline ? 'col-span-2' : ''}>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
            {multiline ? (
                <textarea rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-none`} />
            ) : (
                <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
            )}
        </div>
    )
}
