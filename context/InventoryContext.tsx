'use client'

import React, {
    createContext,
    useContext,
    useState,
    useMemo,
    useCallback,
    useEffect,
} from 'react'

import { supabase }         from '@/lib/supabase'
import { getDealershipId, getDealershipProfile }  from '@/lib/tenant'
import { generateAutoPOs }  from '@/utils/generateAutoPOs'
import { emit, useAutoRefresh } from '@/lib/realtime'

import type { Motorcycle, SparePart, Accessory, PurchaseOrder, InventoryCategory } from '@/utils/types'

// ─── DB row → TypeScript type mappers ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToMotorcycle(r: any): Motorcycle {
    return {
        id:           r.id,
        name:         r.name,
        articleNumber: r.article_number,
        brand:        r.brand,
        vin:          r.vin,
        year:         r.year,
        engineCC:     r.engine_cc,
        color:        r.color,
        mcType:       r.mc_type,
        warehouse:    r.warehouse,
        stock:        r.stock,
        reorderQty:   r.reorder_qty,
        cost:         Number(r.cost),
        sellingPrice: Number(r.selling_price),
        vendor:       r.vendor,
        description:  r.description,
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToSparePart(r: any): SparePart {
    return {
        id:           r.id,
        name:         r.name,
        articleNumber: r.article_number,
        brand:        r.brand,
        category:     r.category,
        stock:        r.stock,
        reorderQty:   r.reorder_qty,
        cost:         Number(r.cost),
        sellingPrice: Number(r.selling_price),
        vendor:       r.vendor,
        description:  r.description,
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToAccessory(r: any): Accessory {
    return {
        id:           r.id,
        name:         r.name,
        articleNumber: r.article_number,
        brand:        r.brand,
        category:     r.category,
        size:         r.size ?? undefined,
        stock:        r.stock,
        reorderQty:   r.reorder_qty,
        cost:         Number(r.cost),
        sellingPrice: Number(r.selling_price),
        vendor:       r.vendor,
        description:  r.description,
    }
}

// ─── Context shape ─────────────────────────────────────────────────────────────

interface InventoryContextValue {
    motorcycles: Motorcycle[]
    spareParts:  SparePart[]
    accessories: Accessory[]
    autoPOs:     PurchaseOrder[]
    loading:     boolean
    /** Adjust a single item's stock to an absolute value (not a delta). */
    updateStock: (id: string, newStock: number) => void
    /** Insert a new item into the correct Supabase table and update local state. */
    addItem: (category: InventoryCategory, item: Motorcycle | SparePart | Accessory) => Promise<void>
    /** Update all fields of an existing item in Supabase and local state. */
    updateItem: (category: InventoryCategory, item: Motorcycle | SparePart | Accessory) => Promise<void>
    /** Delete an item from Supabase and remove from local state. */
    deleteItem: (id: string) => Promise<void>
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────────

export function InventoryProvider({ children }: { children: React.ReactNode }) {
    const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
    const [spareParts,  setSpareParts ] = useState<SparePart[] >([])
    const [accessories, setAccessories] = useState<Accessory[] >([])
    const [loading,     setLoading    ] = useState(true)

    // Fetch all inventory from Supabase
    const loadInventory = useCallback(async () => {
        const dealershipId = getDealershipId()
        if (!dealershipId) { setLoading(false); return }

        // Ensure this dealership row exists before any FK-constrained insert.
        // Uses a server-side route (service-role) so RLS never blocks the write.
        const profile = getDealershipProfile()
        fetch('/api/dealership/ensure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dealershipId,
                name:  profile.name  || 'Dealership',
                email: profile.email || null,
                phone: profile.phone || null,
            }),
        }).catch((err) => console.error('[dealerships] ensure fetch error:', err))

        const [mcs, sps, accs] = await Promise.all([
            supabase.from('motorcycles').select('*').eq('dealership_id', dealershipId).order('id'),
            supabase.from('spare_parts').select('*').eq('dealership_id', dealershipId).order('id'),
            supabase.from('accessories').select('*').eq('dealership_id', dealershipId).order('id'),
        ])
        if (mcs.data)  setMotorcycles(mcs.data.map(dbToMotorcycle))
        if (sps.data)  setSpareParts(sps.data.map(dbToSparePart))
        if (accs.data) setAccessories(accs.data.map(dbToAccessory))
        setLoading(false)
    }, [])

    useEffect(() => { loadInventory() }, [loadInventory])
    useAutoRefresh(loadInventory)

    /**
     * Optimistically update React state, then persist to Supabase.
     * ID prefix determines the table: MC- → motorcycles, SP- → spare_parts, ACC- → accessories
     */
    const updateStock = useCallback((id: string, newStock: number) => {
        const qty = Math.max(0, newStock)
        setMotorcycles((prev) => prev.map((m) => m.id === id ? { ...m, stock: qty } : m))
        setSpareParts ((prev) => prev.map((s) => s.id === id ? { ...s, stock: qty } : s))
        setAccessories((prev) => prev.map((a) => a.id === id ? { ...a, stock: qty } : a))

        const table = id.startsWith('MC-')  ? 'motorcycles'
                    : id.startsWith('SP-')  ? 'spare_parts'
                    : 'accessories'
        const dealershipId = getDealershipId()
        if (!dealershipId) return
        supabase.from(table).update({ stock: qty }).eq('id', id).eq('dealership_id', dealershipId).then()
        emit({ type: 'data:refresh' })
    }, [])

    /**
     * Insert a new item into Supabase and optimistically append to local state.
     */
    const addItem = useCallback(async (
        category: InventoryCategory,
        item: Motorcycle | SparePart | Accessory,
    ) => {
        const dealershipId = getDealershipId()
        if (!dealershipId) throw new Error('Not authenticated: no dealership context')

        if (category === 'motorcycles') {
            const mc = item as Motorcycle
            const { error } = await supabase.from('motorcycles').insert({
                id:            mc.id,
                dealership_id: dealershipId,
                article_number: mc.articleNumber,
                name:          mc.name,
                brand:         mc.brand,
                description:   mc.description,
                vin:           mc.vin,
                year:          mc.year,
                engine_cc:     mc.engineCC,
                color:         mc.color,
                mc_type:       mc.mcType,
                warehouse:     mc.warehouse,
                stock:         mc.stock,
                reorder_qty:   mc.reorderQty,
                cost:          mc.cost,
                selling_price: mc.sellingPrice,
                vendor:        mc.vendor,
            })
            if (error) throw new Error(error.message)
            setMotorcycles((prev) => [mc, ...prev])
        } else if (category === 'spareParts') {
            const sp = item as SparePart
            const { error } = await supabase.from('spare_parts').insert({
                id:            sp.id,
                dealership_id: dealershipId,
                article_number: sp.articleNumber,
                name:          sp.name,
                brand:         sp.brand,
                description:   sp.description,
                category:      sp.category,
                stock:         sp.stock,
                reorder_qty:   sp.reorderQty,
                cost:          sp.cost,
                selling_price: sp.sellingPrice,
                vendor:        sp.vendor,
            })
            if (error) throw new Error(error.message)
            setSpareParts((prev) => [sp, ...prev])
        } else {
            const acc = item as Accessory
            const { error } = await supabase.from('accessories').insert({
                id:            acc.id,
                dealership_id: dealershipId,
                article_number: acc.articleNumber,
                name:          acc.name,
                brand:         acc.brand,
                description:   acc.description,
                category:      acc.category,
                size:          acc.size ?? null,
                stock:         acc.stock,
                reorder_qty:   acc.reorderQty,
                cost:          acc.cost,
                selling_price: acc.sellingPrice,
                vendor:        acc.vendor,
            })
            if (error) throw new Error(error.message)
            setAccessories((prev) => [acc, ...prev])
        }
    }, [])

    const updateItem = useCallback(async (
        category: InventoryCategory,
        item: Motorcycle | SparePart | Accessory,
    ) => {
        const dealershipId = getDealershipId()
        if (category === 'motorcycles') {
            const mc = item as Motorcycle
            await supabase.from('motorcycles').update({
                name: mc.name, brand: mc.brand, description: mc.description,
                article_number: mc.articleNumber, vin: mc.vin, year: mc.year,
                engine_cc: mc.engineCC, color: mc.color, mc_type: mc.mcType,
                warehouse: mc.warehouse, stock: mc.stock, reorder_qty: mc.reorderQty,
                cost: mc.cost, selling_price: mc.sellingPrice, vendor: mc.vendor,
            }).eq('id', mc.id).eq('dealership_id', dealershipId)
            setMotorcycles(prev => prev.map(m => m.id === mc.id ? mc : m))
        } else if (category === 'spareParts') {
            const sp = item as SparePart
            await supabase.from('spare_parts').update({
                name: sp.name, brand: sp.brand, description: sp.description,
                article_number: sp.articleNumber, category: sp.category,
                stock: sp.stock, reorder_qty: sp.reorderQty,
                cost: sp.cost, selling_price: sp.sellingPrice, vendor: sp.vendor,
            }).eq('id', sp.id).eq('dealership_id', dealershipId)
            setSpareParts(prev => prev.map(s => s.id === sp.id ? sp : s))
        } else {
            const acc = item as Accessory
            await supabase.from('accessories').update({
                name: acc.name, brand: acc.brand, description: acc.description,
                article_number: acc.articleNumber, category: acc.category,
                size: acc.size ?? null, stock: acc.stock, reorder_qty: acc.reorderQty,
                cost: acc.cost, selling_price: acc.sellingPrice, vendor: acc.vendor,
            }).eq('id', acc.id).eq('dealership_id', dealershipId)
            setAccessories(prev => prev.map(a => a.id === acc.id ? acc : a))
        }
        emit({ type: 'data:refresh' })
    }, [])

    const deleteItem = useCallback(async (id: string) => {
        const dealershipId = getDealershipId()
        const table = id.startsWith('MC-') ? 'motorcycles'
                    : id.startsWith('SP-') ? 'spare_parts'
                    : 'accessories'
        await supabase.from(table).delete().eq('id', id).eq('dealership_id', dealershipId)
        setMotorcycles(prev => prev.filter(m => m.id !== id))
        setSpareParts (prev => prev.filter(s => s.id !== id))
        setAccessories(prev => prev.filter(a => a.id !== id))
        emit({ type: 'data:refresh' })
    }, [])

    /**
     * Auto-POs are re-derived every time inventory state changes.
     * They are NOT stored in Supabase — generated client-side only.
     */
    const autoPOs = useMemo(
        () => generateAutoPOs(motorcycles, spareParts, accessories),
        [motorcycles, spareParts, accessories]
    )

    return (
        <InventoryContext.Provider value={{ motorcycles, spareParts, accessories, autoPOs, loading, updateStock, addItem, updateItem, deleteItem }}>
            {children}
        </InventoryContext.Provider>
    )
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useInventory(): InventoryContextValue {
    const ctx = useContext(InventoryContext)
    if (!ctx) throw new Error('useInventory must be used inside <InventoryProvider>')
    return ctx
}