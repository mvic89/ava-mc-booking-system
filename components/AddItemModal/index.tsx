'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useInventory } from '@/context/InventoryContext'
import { AddSupplierModal } from '@/components/AddSupplierModal'
import { supabase } from '@/lib/supabase'
import { getDealershipId, getDealershipTag, tagFromName } from '@/lib/tenant'
import type { InventoryCategory, MCType, Warehouse } from '@/utils/types'
import type { SupplierRow } from '@/components/SupplierFormShared'

// ─── ID generator ─────────────────────────────────────────────────────────────
// IDs are globally unique: MC-AVA-4D85-001, SP-AVA-4D85-001, ACC-AVA-4D85-001
// Format: {TYPE}-{NAME_TAG}-{UUID_FINGERPRINT}-{SEQ}
//   NAME_TAG        = first 3 chars of dealership name (e.g. "AVA")
//   UUID_FINGERPRINT = first 4 hex chars of dealership UUID (e.g. "4D85")
// This ensures two dealers with the same name tag never collide in Supabase.

function generateNextId(type: InventoryCategory, existingIds: string[], dealershipId: string | null, dbName?: string | null): string {
    const prefix = type === 'motorcycles' ? 'MC' : type === 'spareParts' ? 'SP' : 'ACC'
    const tag    = dbName ? tagFromName(dbName) : getDealershipTag()
    // Take first 4 hex chars of the UUID (strips dashes first) as a short fingerprint
    const fp     = (dealershipId ?? '').replace(/-/g, '').substring(0, 4).toUpperCase() || 'XXXX'
    const taggedPrefix = `${prefix}-${tag}-${fp}-`
    const nums = existingIds
        .filter((id) => id.startsWith(taggedPrefix))
        .map((id) => parseInt(id.replace(taggedPrefix, ''), 10))
        .filter((n) => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${taggedPrefix}${String(next).padStart(3, '0')}`
}

function supNum(existingNumbers: string[], dealershipId: string | null, dbName?: string | null): string {
    const tag    = dbName ? tagFromName(dbName) : getDealershipTag()
    const fp     = (dealershipId ?? '').replace(/-/g, '').substring(0, 4).toUpperCase() || 'XXXX'
    const prefix = `SUP-${tag}-${fp}-`
    const nums   = existingNumbers
        .filter((id) => id.startsWith(prefix))
        .map((id) => parseInt(id.replace(prefix, ''), 10))
        .filter((n) => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${prefix}${String(next).padStart(3, '0')}`
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
    { id: 'motorcycles', label: 'Motorcycle', icon: '🏍️', color: 'border-orange-400 bg-orange-50 text-orange-700' },
    { id: 'spareParts',  label: 'Spare Part', icon: '🔧', color: 'border-blue-400  bg-blue-50  text-blue-700'   },
    { id: 'accessories', label: 'Accessory',  icon: '🪖', color: 'border-purple-400 bg-purple-50 text-purple-700' },
]

// ─── Section divider ──────────────────────────────────────────────────────────

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
    const { motorcycles, spareParts, accessories, addItem, updateItem } = useInventory()

    const [type, setType]           = useState<InventoryCategory | ''>('')
    const [saving, setSaving]       = useState(false)
    const [error, setError]         = useState('')
    const [showAddSupplier, setShowAddSupplier] = useState(false)

    // Supplier list loaded from DB + derived from context
    const [dbSuppliers,       setDbSuppliers]       = useState<string[]>([])
    const [dbSupplierNumbers, setDbSupplierNumbers] = useState<string[]>([])
    const [dbDealershipName,  setDbDealershipName]  = useState<string | null>(null)
    const [loadingSuppliers,  setLoadingSuppliers]  = useState(true)
    const [showVendorDrop,    setShowVendorDrop]     = useState(false)
    const vendorRef = useRef<HTMLDivElement>(null)

    // Derive vendor names from all inventory items in context
    const contextVendors = useMemo(() => {
        const names = new Set<string>()
        motorcycles.forEach((m) => m.vendor && names.add(m.vendor))
        spareParts.forEach((s)  => s.vendor && names.add(s.vendor))
        accessories.forEach((a) => a.vendor && names.add(a.vendor))
        return names
    }, [motorcycles, spareParts, accessories])

    // Fetch manual vendors from Supabase (scoped to this dealership) and merge with context vendors
    useEffect(() => {
        const dealershipId = getDealershipId()
        const query = dealershipId
            ? supabase.from('vendors').select('name, supplier_number').eq('dealership_id', dealershipId)
            : supabase.from('vendors').select('name, supplier_number')
        query.then(({ data }) => {
            const all = new Set(contextVendors)
            if (data) data.forEach((r) => r.name && all.add(r.name))
            setDbSuppliers([...all].filter(Boolean).sort())
            setDbSupplierNumbers((data ?? []).map((r) => r.supplier_number).filter(Boolean))
            setLoadingSuppliers(false)
        })
        if (dealershipId) {
            supabase.from('dealerships').select('name').eq('id', dealershipId).single()
                .then(({ data }) => { if (data?.name) setDbDealershipName(data.name) })
        }
    }, [contextVendors])

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
    const [location, setLocation]           = useState('')

    // Motorcycle-specific
    const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/  // exactly 17 chars, no I/O/Q
    const [vin, setVin]             = useState('')
    const [engineCC, setEngineCC]   = useState('')
    const [color, setColor]         = useState('')
    const [year, setYear]           = useState(String(new Date().getFullYear()))
    const [mcType, setMcType]       = useState<MCType>('New')
    const [warehouse, setWarehouse] = useState<Warehouse>('Warehouse A')

    // Spare part-specific
    const [spCategory, setSpCategory] = useState('')

    // Accessory-specific
    const [accCategory, setAccCategory] = useState('')
    const [accSubGroup, setAccSubGroup] = useState('')
    const [size, setSize]               = useState('')
    const [accColor, setAccColor]       = useState('')

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

    // Auto-generate item ID when type is chosen (includes dealership UUID fingerprint)
    const autoId = useMemo(() => {
        if (!type) return ''
        const dealershipId = getDealershipId()
        const existingIds =
            type === 'motorcycles' ? motorcycles.map((m) => m.id) :
            type === 'spareParts'  ? spareParts.map((s) => s.id)  :
                                     accessories.map((a) => a.id)
        return generateNextId(type, existingIds, dealershipId, dbDealershipName)
    }, [type, motorcycles, spareParts, accessories, dbDealershipName])

    // ── Duplicate detection state ────────────────────────────────────────────────
    // When the user tries to save, if an item with the same name or article number
    // already exists in this dealer's inventory, we show a conflict step.
    type AnyItem = (typeof motorcycles)[0] | (typeof spareParts)[0] | (typeof accessories)[0]
    const [duplicateStep,   setDuplicateStep]   = useState(false)
    const [duplicateItem,   setDuplicateItem]   = useState<AnyItem | null>(null)
    // Why was the duplicate flagged?
    // 'exact'       – same name + same article number
    // 'nameAndBrand'– same name + same brand, but different article number
    // 'nameOnly'    – same name only (different brand + different article)
    // 'articleOnly' – same article number, but different name/brand
    const [duplicateReason, setDuplicateReason] = useState<'exact' | 'nameAndBrand' | 'nameOnly' | 'articleOnly'>('exact')

    const typeLabel =
        type === 'motorcycles' ? 'Motorcycle' :
        type === 'spareParts'  ? 'Spare Part' :
        type === 'accessories' ? 'Accessory'  : ''

    // Next supplier number for the inline add-supplier modal
    const nextSupplierNumber = supNum(dbSupplierNumbers, getDealershipId(), dbDealershipName)

    // Supplier combobox helpers
    const filteredSuppliers = useMemo(() =>
        vendor.trim()
            ? dbSuppliers.filter((s) => s.toLowerCase().includes(vendor.toLowerCase()))
            : dbSuppliers,
    [vendor, dbSuppliers])

    const vendorExistsInDB = dbSuppliers.some(
        (s) => s.toLowerCase() === vendor.trim().toLowerCase()
    )

    // VIN error: format check (shown while typing)
    const vinError = vin.trim() !== '' && !VIN_REGEX.test(vin.trim().toUpperCase())
        ? `VIN must be exactly 17 alphanumeric characters (I, O, Q not allowed). Currently ${vin.trim().length} character${vin.trim().length !== 1 ? 's' : ''}.`
        : ''

    // VIN duplicate check: query ALL dealerships (VINs are globally unique)
    const [vinChecking,  setVinChecking]  = useState(false)
    const [vinDuplicate, setVinDuplicate] = useState<string | null>(null) // null = no dupe, string = existing item name

    useEffect(() => {
        const v = vin.trim().toUpperCase()
        if (!VIN_REGEX.test(v)) { setVinDuplicate(null); return }
        setVinChecking(true)
        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from('motorcycles')
                .select('name')
                .eq('vin', v)
                .limit(1)
            setVinDuplicate(data && data.length > 0 ? (data[0].name as string) : null)
            setVinChecking(false)
        }, 400)
        return () => clearTimeout(timer)
    }, [vin])

    const canSubmit =
        !!type &&
        name.trim() !== '' &&
        brand.trim() !== '' &&
        articleNumber.trim() !== '' &&
        vendor !== '' &&
        stock !== '' &&
        reorderQty !== '' &&
        cost !== '' &&
        sellingPrice !== '' &&
        (type !== 'motorcycles' || (vin.trim() !== '' && VIN_REGEX.test(vin.trim().toUpperCase()) && !vinDuplicate && !vinChecking)) &&
        (type !== 'spareParts'  || spCategory !== '') &&
        (type !== 'accessories' || (accCategory !== '' && size.trim() !== ''))

    async function handleSubmit(skipDuplicateCheck = false) {
        if (!canSubmit || !type) return

        // ── Duplicate check ─────────────────────────────────────────────────────
        if (!skipDuplicateCheck) {
            const pool =
                type === 'motorcycles' ? (motorcycles as AnyItem[]) :
                type === 'spareParts'  ? (spareParts  as AnyItem[]) :
                                         (accessories as AnyItem[])
            const nameLower    = name.trim().toLowerCase()
            const articleLower = articleNumber.trim().toLowerCase()
            const found = pool.find(
                (item) =>
                    item.name.trim().toLowerCase() === nameLower ||
                    // Only match on article number if both sides are non-empty (null-safe)
                    (articleLower !== '' && (item.articleNumber ?? '').trim().toLowerCase() === articleLower),
            )
            if (found) {
                const nameSame    = found.name.trim().toLowerCase()          === nameLower
                const brandSame   = (found.brand ?? '').trim().toLowerCase() === brand.trim().toLowerCase()
                const articleSame = articleLower !== '' && (found.articleNumber ?? '').trim().toLowerCase() === articleLower
                const reason =
                    nameSame && articleSame ? 'exact' :
                    nameSame && brandSame   ? 'nameAndBrand' :
                    nameSame                ? 'nameOnly' :
                                             'articleOnly'
                setDuplicateItem(found)
                setDuplicateReason(reason)
                setDuplicateStep(true)
                return
            }
        }

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
                    location: location.trim() || undefined,
                    vin: vin.trim().toUpperCase(),
                    engineCC: parseInt(engineCC) || 0,
                    color: color.trim(),
                    year: parseInt(year) || new Date().getFullYear(),
                    mcType,
                    warehouse,
                })
            } else if (type === 'spareParts') {
                await addItem('spareParts', {
                    id: autoId, articleNumber: articleNumber.trim(),
                    name: name.trim(), brand: brand.trim(),
                    description: description.trim(),
                    stock: parseInt(stock) || 0,
                    reorderQty: parseInt(reorderQty) || 0,
                    cost: parseFloat(cost) || 0,
                    sellingPrice: parseFloat(sellingPrice) || 0,
                    vendor: vendor.trim(),
                    location: location.trim() || undefined,
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
                    location: location.trim() || undefined,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    category: accCategory as any,
                    subGroup: accSubGroup.trim() || undefined,
                    size: size.trim() || undefined,
                    color: accColor.trim() || undefined,
                })
            }
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to save item'
            // If the DB unique constraint fired (article number already exists for this dealer),
            // fall back to showing the conflict screen instead of a raw error message.
            if (msg.includes('article_dealer_uniq') || msg.includes('duplicate key')) {
                const pool =
                    type === 'motorcycles' ? (motorcycles as AnyItem[]) :
                    type === 'spareParts'  ? (spareParts  as AnyItem[]) :
                                             (accessories as AnyItem[])
                const articleLower = articleNumber.trim().toLowerCase()
                const nameLower    = name.trim().toLowerCase()
                const existing = pool.find(
                    (item) =>
                        (articleLower !== '' && (item.articleNumber ?? '').trim().toLowerCase() === articleLower) ||
                        item.name.trim().toLowerCase() === nameLower,
                )
                if (existing) {
                    const nameSame    = existing.name.trim().toLowerCase()          === nameLower
                    const brandSame   = (existing.brand ?? '').trim().toLowerCase() === brand.trim().toLowerCase()
                    const articleSame = articleLower !== '' && (existing.articleNumber ?? '').trim().toLowerCase() === articleLower
                    const reason =
                        nameSame && articleSame ? 'exact' :
                        nameSame && brandSame   ? 'nameAndBrand' :
                        nameSame                ? 'nameOnly' :
                                                 'articleOnly'
                    setDuplicateItem(existing)
                    setDuplicateReason(reason)
                    setDuplicateStep(true)
                    return
                }
            }
            setError(msg)
        } finally {
            setSaving(false)
        }
    }

    // Called when user picks "Add to existing stock" in the duplicate step
    async function handleAddToExistingStock() {
        if (!duplicateItem || !type) return
        setSaving(true)
        try {
            const addQty = parseInt(stock) || 0
            await updateItem(type, { ...duplicateItem, stock: duplicateItem.stock + addQty })
            onClose()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update stock')
        } finally {
            setSaving(false)
        }
    }

    // Called when a new supplier is saved from the inline AddSupplierModal
    async function handleSupplierSaved(s: SupplierRow) {
        await supabase.from('vendors').upsert({
            name:                    s.name,
            dealership_id:           getDealershipId(),
            address:                 s.address,
            phone:                   s.phone,
            org_number:              s.orgNumber,
            free_shipping_threshold: s.freeShippingThreshold,
            supplier_number:         s.supplierNumber,
            categories:              [],
            is_manual:               true,
        }, { onConflict: 'name,dealership_id' })
        setDbSuppliers((prev) => [...prev, s.name].sort())
        setVendor(s.name)
        setShowAddSupplier(false)
    }

    const isDirty = type !== '' || name !== '' || brand !== '' || articleNumber !== '' || vendor !== '' || cost !== '' || sellingPrice !== ''

    function handleBackdropClick() {
        if (isDirty) {
            if (!window.confirm('You have unsaved changes. Discard them and close?')) return
        }
        onClose()
    }

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={handleBackdropClick}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ── Header ──────────────────────────────────────────── */}
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
                            onClick={handleBackdropClick}
                            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-bold shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    {/* ── Duplicate item conflict screen ───────────────────── */}
                    {duplicateStep && duplicateItem && (
                        <>
                            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl mt-0.5">⚠️</span>
                                    <div>
                                        {duplicateReason === 'exact' && (
                                            <>
                                                <p className="text-sm font-semibold text-gray-800 mb-0.5">This exact item already exists</p>
                                                <p className="text-xs text-gray-500">Same name and article number found in your inventory.</p>
                                            </>
                                        )}
                                        {duplicateReason === 'nameAndBrand' && (
                                            <>
                                                <p className="text-sm font-semibold text-gray-800 mb-0.5">Same name &amp; brand — different article number</p>
                                                <p className="text-xs text-gray-500">
                                                    An item with the same name and brand exists but has a different article number.
                                                    You can add stock to it, or save yours as a separate product.
                                                </p>
                                            </>
                                        )}
                                        {duplicateReason === 'nameOnly' && (
                                            <>
                                                <p className="text-sm font-semibold text-gray-800 mb-0.5">Same item name — different brand &amp; article</p>
                                                <p className="text-xs text-gray-500">
                                                    An item with the same name was found but from a different brand.
                                                    You can add stock to it, or save yours as a separate product.
                                                </p>
                                            </>
                                        )}
                                        {duplicateReason === 'articleOnly' && (
                                            <>
                                                <p className="text-sm font-semibold text-gray-800 mb-0.5">
                                                    Article number already taken by &ldquo;{duplicateItem.name}&rdquo;
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Article number <span className="font-mono font-semibold">{articleNumber.trim()}</span> belongs
                                                    to a different product. You can add stock to that item, or go back and use a different article number.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Existing item card */}
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Existing Item</p>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{duplicateItem.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {duplicateItem.brand}
                                                <span className="mx-1.5 text-gray-300">·</span>
                                                <span className="font-mono">{duplicateItem.articleNumber}</span>
                                                <span className="mx-1.5 text-gray-300">·</span>
                                                {duplicateItem.id}
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-gray-500 shrink-0">
                                            <div>Stock: <span className="font-semibold text-gray-700">{duplicateItem.stock}</span></div>
                                            <div>Reorder at: <span className="font-semibold text-gray-700">{duplicateItem.reorderQty}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* What the user is adding */}
                                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                                    <p className="text-[10px] uppercase tracking-widest text-orange-400 font-semibold mb-2">You Are Adding</p>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{name.trim()}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {brand.trim()}
                                                <span className="mx-1.5 text-gray-300">·</span>
                                                <span className="font-mono">{articleNumber.trim()}</span>
                                            </p>
                                        </div>
                                        <div className="text-right text-xs text-gray-500 shrink-0">
                                            <div>Stock to add: <span className="font-semibold text-orange-600">+{parseInt(stock) || 0}</span></div>
                                            <div>New total: <span className="font-semibold text-gray-700">{duplicateItem.stock + (parseInt(stock) || 0)}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Choices */}
                                <div className="space-y-2">
                                    <button
                                        onClick={handleAddToExistingStock}
                                        disabled={saving}
                                        className="w-full px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold text-left flex items-center justify-between transition-colors"
                                    >
                                        <span>Add stock to existing item</span>
                                        <span className="text-xs opacity-80">
                                            Stock: {duplicateItem.stock} → {duplicateItem.stock + (parseInt(stock) || 0)}
                                        </span>
                                    </button>
                                    {(duplicateReason === 'exact' || duplicateReason === 'articleOnly') ? (
                                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            Article number <span className="font-mono font-semibold">{articleNumber.trim()}</span> is already taken.
                                            Go back and use a different article number to save as a separate item.
                                        </p>
                                    ) : (
                                        <button
                                            onClick={() => handleSubmit(true)}
                                            disabled={saving}
                                            className="w-full px-4 py-3 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-40 border border-gray-200 text-gray-700 text-sm font-semibold text-left flex items-center justify-between transition-colors"
                                        >
                                            <span>Save as a separate new item</span>
                                            <span className="text-xs text-gray-400">New ID: {autoId}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                                <button
                                    onClick={() => { setDuplicateStep(false); setDuplicateItem(null) }}
                                    className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                                >
                                    ← Back to form
                                </button>
                                {error && <p className="text-xs text-red-500">{error}</p>}
                            </div>
                        </>
                    )}

                    {/* ── Scrollable body ──────────────────────────────────── */}
                    {!duplicateStep && <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

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
                                    <Field label="Brand" required>
                                        <input className={inputCls} placeholder="e.g. Yamaha" value={brand} onChange={(e) => setBrand(e.target.value)} />
                                    </Field>
                                    <Field label="Article Number" required>
                                        <input className={inputCls} placeholder="e.g. ART-00123" value={articleNumber} onChange={(e) => setArticleNumber(e.target.value)} />
                                    </Field>
                                    <Field label="Location">
                                        <input className={inputCls} placeholder="e.g. B3-12" value={location} onChange={(e) => setLocation(e.target.value)} />
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

                                {/* ── Supplier ── */}
                                <Section title="Supplier" />
                                <Field label="Supplier" required>
                                    {/* Combobox: type to filter, click to select, or enter manually */}
                                    <div className="relative" ref={vendorRef}>
                                        <input
                                            className={inputCls}
                                            placeholder={loadingSuppliers ? 'Loading suppliers…' : 'Search or type supplier name…'}
                                            value={vendor}
                                            disabled={loadingSuppliers}
                                            onChange={(e) => { setVendor(e.target.value); setShowVendorDrop(true) }}
                                            onFocus={() => setShowVendorDrop(true)}
                                            onBlur={() => setTimeout(() => setShowVendorDrop(false), 150)}
                                        />
                                        {/* Clear button */}
                                        {vendor && (
                                            <button
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); setVendor(''); setShowVendorDrop(true) }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs font-bold"
                                            >
                                                ✕
                                            </button>
                                        )}
                                        {/* Dropdown list */}
                                        {showVendorDrop && filteredSuppliers.length > 0 && (
                                            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                                {filteredSuppliers.map((s) => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onMouseDown={() => { setVendor(s); setShowVendorDrop(false) }}
                                                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                                            vendor === s
                                                                ? 'bg-orange-50 text-orange-700 font-semibold'
                                                                : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
                                                        }`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Warning: typed value not in DB */}
                                    {vendor.trim() && !vendorExistsInDB && !loadingSuppliers && (
                                        <div className="mt-2 flex items-center justify-between gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-500 text-base">⚠️</span>
                                                <span className="text-xs text-amber-700 font-medium">
                                                    Supplier not existing in the system.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddSupplier(true)}
                                                className="shrink-0 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                + Add Supplier
                                            </button>
                                        </div>
                                    )}
                                </Field>

                                {/* ── Pricing & Stock ── */}
                                <Section title="Pricing & Stock" />
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Stock (units)" required>
                                        <input className={inputCls} type="number" min="0" placeholder="0" value={stock} onChange={(e) => setStock(e.target.value)} />
                                    </Field>
                                    <Field label="Reorder Qty" required>
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
                                                <div className="relative">
                                                    <input
                                                        className={inputCls + (vinError || vinDuplicate ? ' border-red-400 focus:ring-red-400' : '')}
                                                        placeholder="e.g. ME4RG3227P8000001"
                                                        value={vin}
                                                        maxLength={17}
                                                        onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ''))}
                                                    />
                                                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold ${
                                                        vin.length === 0    ? 'text-gray-300'
                                                        : vinChecking       ? 'text-gray-400'
                                                        : vinDuplicate      ? 'text-red-500'
                                                        : vin.length === 17 ? 'text-green-500'
                                                        : 'text-red-400'
                                                    }`}>
                                                        {vinChecking ? '…' : `${vin.length}/17`}
                                                    </span>
                                                </div>
                                                {vinError && (
                                                    <p className="mt-1 text-xs text-red-500">{vinError}</p>
                                                )}
                                                {vinDuplicate && !vinError && (
                                                    <p className="mt-1 text-xs text-red-600 font-medium">
                                                        VIN already registered to &ldquo;{vinDuplicate}&rdquo;. Please check the VIN number.
                                                    </p>
                                                )}
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
                                            <Field label="MC Type" required>
                                                <select className={selectCls} value={mcType} onChange={(e) => setMcType(e.target.value as MCType)}>
                                                    <option value="New">New</option>
                                                    <option value="Trade-In">Trade-In</option>
                                                    <option value="Commission">Commission</option>
                                                </select>
                                            </Field>
                                            <Field label="Warehouse" required>
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
                                            <Field label="Type" required>
                                                <select className={selectCls} value={accCategory} onChange={(e) => { setAccCategory(e.target.value); setAccSubGroup('') }}>
                                                    <option value="">— Select category —</option>
                                                    <optgroup label="Helmets">
                                                        <option>Helmet</option>
                                                    </optgroup>
                                                    <optgroup label="Clothing">
                                                        <option>Jacket</option>
                                                        <option>Gloves</option>
                                                        <option>T-Shirt</option>
                                                        <option>Pants</option>
                                                        <option>Boots</option>
                                                        <option>Cap</option>
                                                        <option>Neck &amp; Face</option>
                                                    </optgroup>
                                                    <optgroup label="Other">
                                                        <option>Seat Cover</option>
                                                        <option>Protection</option>
                                                        <option>Luggage</option>
                                                        <option>Handlebars &amp; Grips</option>
                                                    </optgroup>
                                                </select>
                                            </Field>
                                            <Field label="Size" required>
                                                <input className={inputCls} placeholder="e.g. M, L, XL or 42" value={size} onChange={(e) => setSize(e.target.value)} />
                                            </Field>
                                            <Field label="Colour">
                                                <input className={inputCls} placeholder="e.g. Black, Midnight Blue" value={accColor} onChange={(e) => setAccColor(e.target.value)} />
                                            </Field>
                                            {ACC_STYLES[accCategory] && (
                                                <Field label="Style">
                                                    <select className={selectCls} value={accSubGroup} onChange={(e) => setAccSubGroup(e.target.value)}>
                                                        <option value="">— Select style —</option>
                                                        {ACC_STYLES[accCategory].map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                </Field>
                                            )}
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
                    </div>}

                    {/* ── Footer ──────────────────────────────────────────── */}
                    {!duplicateStep && <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                        <p className="text-xs text-gray-400">
                            {autoId
                                ? <>ID <span className="font-semibold text-gray-600">{autoId}</span> auto-assigned</>
                                : 'Select a type to auto-assign an ID'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleBackdropClick}
                                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSubmit()}
                                disabled={!canSubmit || saving}
                                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                {saving ? 'Adding…' : '+ Add Item'}
                            </button>
                        </div>
                    </div>}
                </div>
            </div>

            {/* Inline Add Supplier modal — stacked above Add Item modal */}
            {showAddSupplier && (
                <AddSupplierModal
                    supplierNumber={nextSupplierNumber}
                    onSave={handleSupplierSaved}
                    onClose={() => setShowAddSupplier(false)}
                    onBack={() => setShowAddSupplier(false)}
                />
            )}
        </>
    )
}
