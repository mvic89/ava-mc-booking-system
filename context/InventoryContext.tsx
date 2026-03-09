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
import { generateAutoPOs }  from '@/utils/generateAutoPOs'

import type { Motorcycle, SparePart, Accessory, PurchaseOrder } from '@/utils/types'

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
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────────

export function InventoryProvider({ children }: { children: React.ReactNode }) {
    const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
    const [spareParts,  setSpareParts ] = useState<SparePart[] >([])
    const [accessories, setAccessories] = useState<Accessory[] >([])
    const [loading,     setLoading    ] = useState(true)

    // Fetch all inventory from Supabase on mount
    useEffect(() => {
        async function loadInventory() {
            const [mcs, sps, accs] = await Promise.all([
                supabase.from('motorcycles').select('*').order('id'),
                supabase.from('spare_parts').select('*').order('id'),
                supabase.from('accessories').select('*').order('id'),
            ])
            if (mcs.data)  setMotorcycles(mcs.data.map(dbToMotorcycle))
            if (sps.data)  setSpareParts(sps.data.map(dbToSparePart))
            if (accs.data) setAccessories(accs.data.map(dbToAccessory))
            setLoading(false)
        }
        loadInventory()
    }, [])

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
        supabase.from(table).update({ stock: qty }).eq('id', id)
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
        <InventoryContext.Provider value={{ motorcycles, spareParts, accessories, autoPOs, loading, updateStock }}>
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
