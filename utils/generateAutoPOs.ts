import { Motorcycle, SparePart, Accessory, LowStockAlert } from './types'

/**
 * Scans all inventory for items at or below their reorder point and returns
 * one LowStockAlert per item, sorted by vendor then item name.
 *
 * This replaces the old auto-PO generation. Alerts are informational only —
 * no PO is created automatically. The purchaser reviews alerts, generates a
 * Ref Number per order placed on the supplier portal, and creates a PO manually.
 */
export function generateLowStockAlerts(
    motorcycles: Motorcycle[],
    spareParts:  SparePart[],
    accessories: Accessory[],
): LowStockAlert[] {
    const alerts: LowStockAlert[] = []

    for (const mc of motorcycles) {
        if (mc.stock <= mc.reorderQty) {
            alerts.push({
                inventoryId:  mc.id,
                name:         mc.name,
                articleNumber: mc.articleNumber,
                brand:        mc.brand,
                vendor:       mc.vendor,
                currentStock: mc.stock,
                reorderQty:   mc.reorderQty,
                itemType:     'motorcycle',
                location:     mc.location,
            })
        }
    }

    for (const sp of spareParts) {
        if (sp.stock <= sp.reorderQty) {
            alerts.push({
                inventoryId:  sp.id,
                name:         sp.name,
                articleNumber: sp.articleNumber,
                brand:        sp.brand,
                vendor:       sp.vendor,
                currentStock: sp.stock,
                reorderQty:   sp.reorderQty,
                itemType:     'sparePart',
                location:     sp.location,
            })
        }
    }

    for (const acc of accessories) {
        if (acc.stock <= acc.reorderQty) {
            alerts.push({
                inventoryId:  acc.id,
                name:         acc.name,
                articleNumber: acc.articleNumber,
                brand:        acc.brand,
                vendor:       acc.vendor,
                currentStock: acc.stock,
                reorderQty:   acc.reorderQty,
                itemType:     'accessory',
                location:     acc.location,
            })
        }
    }

    return alerts.sort((a, b) =>
        a.vendor.localeCompare(b.vendor) || a.name.localeCompare(b.name)
    )
}
