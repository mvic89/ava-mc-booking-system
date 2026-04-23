import { Motorcycle, SparePart, Accessory, PurchaseOrder, POLineItem, POStatus } from './types'

/**
 * Generates a stable auto-PO ID in the same format as manual POs.
 * Uses vendor index (alphabetical) for the sequence number so the ID is
 * stable as long as the vendor list doesn't change order.
 */
function vendorToId(tag: string, vendorIndex: number): string {
    const year = new Date().getFullYear()
    const seq  = String(vendorIndex + 1).padStart(3, '0')
    return `PO-${tag}-${year}-${seq}`
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
    tag = 'XXX',
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
    const sortedVendors = [...byVendor.keys()].sort((a, b) => a.localeCompare(b))

    for (const [vendor, items] of byVendor) {
        const vendorIndex = sortedVendors.indexOf(vendor)
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
            id:        vendorToId(tag, vendorIndex),
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
