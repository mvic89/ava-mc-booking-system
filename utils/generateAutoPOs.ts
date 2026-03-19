import { Motorcycle, SparePart, Accessory, PurchaseOrder, POLineItem, POStatus } from './types'

/**
 * Generates a stable PO ID from a vendor name using a simple hash.
 * Same vendor always → same ID, so React state (expandedId, etc.) stays stable.
 */
function vendorToId(vendor: string): string {
    let h = 0
    for (const ch of vendor) {
        h = Math.imul(31, h) + ch.charCodeAt(0) | 0
    }
    return `PO-AUTO-${Math.abs(h).toString(16).toUpperCase().padStart(6, '0').slice(0, 6)}`
}

/**
 * Derive a default ETA date — 30 days out.
 */
function etaFor(_status: POStatus): string {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Scans all inventory for items at or below their reorder point,
 * groups them by vendor, and returns one PurchaseOrder per vendor.
 *
 * Rules:
 *  - stock <= reorderQty → PO status = 'Draft'
 *  - If an item's stock rises above reorderQty it is automatically
 *    removed from the vendor's PO (or the PO disappears entirely).
 */
export function generateAutoPOs(
    motorcycles: Motorcycle[],
    spareParts: SparePart[],
    accessories: Accessory[],
): PurchaseOrder[] {
    const allItems = [...motorcycles, ...spareParts, ...accessories]

    // Collect only items that need reordering
    const lowStock = allItems.filter((item) => item.stock <= item.reorderQty)

    // Group by vendor
    const byVendor = new Map<string, typeof allItems>()
    for (const item of lowStock) {
        if (!byVendor.has(item.vendor)) byVendor.set(item.vendor, [])
        byVendor.get(item.vendor)!.push(item)
    }

    const autoPOs: PurchaseOrder[] = []

    for (const [vendor, items] of byVendor) {
        const status: POStatus = 'Draft'

        const notes = 'Auto-generated — review quantities before sending to supplier.'

        const lineItems: POLineItem[] = items.map((item) => ({
            inventoryId: item.id,
            name:        item.name,
            articleNumber: item.articleNumber,
            // Order enough to bring stock back up to reorderQty above current
            orderQty:  item.reorderQty,
            unitCost:  item.cost,
            lineTotal: item.cost * item.reorderQty,
            ...('size' in item && item.size ? { size: item.size } : {}),
        }))

        const totalCost = lineItems.reduce((s, li) => s + li.lineTotal, 0)

        autoPOs.push({
            id:        vendorToId(vendor),
            vendor,
            date:      new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
            eta:       etaFor(status),
            status,
            items:     lineItems,
            totalCost,
            notes,
        })
    }

    return autoPOs.sort((a, b) => a.vendor.localeCompare(b.vendor))
}
