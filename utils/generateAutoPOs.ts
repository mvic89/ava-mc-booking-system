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
 * Derive a default ETA date from how urgent the PO is.
 * Under Review → 14 days out; Draft → 30 days out.
 */
function etaFor(status: POStatus): string {
    const daysOut = status === 'Under Review' ? 14 : 30
    const d = new Date()
    d.setDate(d.getDate() + daysOut)
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Scans all inventory for items at or below their reorder point,
 * groups them by vendor, and returns one PurchaseOrder per vendor.
 *
 * Rules:
 *  - stock < reorderQty  → PO status = 'Under Review'  (critically low)
 *  - stock === reorderQty → PO status = 'Draft'          (just hit reorder point)
 *  - If a vendor has a mix, the whole PO becomes 'Under Review'
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
        const isCritical = items.some((i) => i.stock < i.reorderQty)
        const status: POStatus = isCritical ? 'Under Review' : 'Draft'

        const critical  = items.filter((i) => i.stock < i.reorderQty)
        const atLimit   = items.filter((i) => i.stock === i.reorderQty)
        const notes = [
            critical.length  ? `${critical.length} item(s) critically below reorder point.`  : '',
            atLimit.length   ? `${atLimit.length} item(s) just reached reorder point.`        : '',
            'Auto-generated — review quantities before sending to supplier.',
        ].filter(Boolean).join(' ')

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

    // Sort: Under Review first, then alphabetically by vendor
    return autoPOs.sort((a, b) => {
        if (a.status === 'Under Review' && b.status !== 'Under Review') return -1
        if (b.status === 'Under Review' && a.status !== 'Under Review') return 1
        return a.vendor.localeCompare(b.vendor)
    })
}
