export interface NavArrayType {
    name: string;
    link: string;
    icon: string;
}

// ─── Inventory Types ───────────────────────────────────────────────────────────

export interface BaseInventoryItem {
    id: string;
    name: string;
    articleNumber: string;
    brand: string;
    stock: number;
    reorderQty: number;
    cost: number;
    sellingPrice: number;
    vendor: string;
    description: string;
    location?: string;         // shelf / bin position, e.g. "B3-12"
    listedOnWebsite?: boolean; // true = this variant is visible on the dealer website
    images?: string[];         // public URLs from Supabase Storage (inventory-images bucket)
}

export type MCType = 'New' | 'Trade-In' | 'Commission';
export type Warehouse = 'Warehouse A' | 'Warehouse B' | 'Warehouse C' | 'Warehouse D';

export interface Motorcycle extends BaseInventoryItem {
    vin: string;
    engineCC: number;
    color: string;
    year: number;
    mcType: MCType;
    warehouse: Warehouse;
}

export interface SparePart extends BaseInventoryItem {
    category: 'Engine' | 'Brakes' | 'Electrical' | 'Transmission' | 'Suspension' | 'Fuel System' | 'Tyres & Wheels' | 'Exhaust' | 'Body & Frame' | 'Cooling System' | 'Filters & Fluids' | 'Controls & Cables' | 'Lighting' | 'Instruments';
    subCategory?: string;
}

export type AccessoryGroup = 'Helmets' | 'Clothing' | 'Seat Covers' | 'Luggage' | 'Protection' | 'Other'

const CLOTHING_CATS = ['Gloves', 'Jacket', 'T-Shirt', 'Boots', 'Pants', 'Cap', 'Neck & Face']
export function accessoryGroup(category: string): AccessoryGroup {
    if (category === 'Helmet') return 'Helmets'
    if (CLOTHING_CATS.includes(category)) return 'Clothing'
    if (category === 'Seat Cover') return 'Seat Covers'
    if (category === 'Luggage') return 'Luggage'
    if (category === 'Protection') return 'Protection'
    return 'Other'
}

export interface Accessory extends BaseInventoryItem {
    category: 'Helmet' | 'Gloves' | 'Jacket' | 'T-Shirt' | 'Boots' | 'Pants' | 'Protection' | 'Luggage' | 'Handlebars & Grips' | 'Cap' | 'Neck & Face' | 'Seat Cover';
    subGroup?: string;  // style variant, e.g. Modular, Full Gauntlet, Leather Racing
    size?: string;
    color?: string;     // product colour, e.g. Black, Midnight Blue
}

export type InventoryCategory = 'motorcycles' | 'spareParts' | 'accessories';

// ─── Purchase Order Types ─────────────────────────────────────────────────────

export interface POLineItem {
    inventoryId: string;
    name: string;
    articleNumber: string;
    orderQty: number;
    unitCost: number;
    lineTotal: number;
    size?: string;  // e.g. 'XS' | 'S' | 'M' | 'L' | 'XL' — for sized accessories
}

export type POStatus = 'Draft' | 'Reviewed' | 'Sent' | 'Received';

// ─── Invoice Types ────────────────────────────────────────────────────────────

export type PurchaseInvoiceStatus = 'Pending' | 'Awaiting Approval' | 'Paid' | 'Overdue' | 'Disputed'

export interface PurchaseInvoice {
    id: string                    // e.g. PINV-2026-001
    supplierInvoiceNumber: string // supplier's own invoice reference
    poId?: string                 // linked PO, if any
    vendor: string
    invoiceDate: string           // ISO date string
    dueDate: string
    amount: number                // gross total incl. VAT (what you pay the supplier)
    vatRate: number               // 0, 12, or 25 (Swedish VAT %)
    creditedAmount?: number       // total credit applied against this invoice
    status: PurchaseInvoiceStatus
    notes?: string
    pdfUrl?: string               // URL to the stored supplier invoice PDF
    poFullyReceived?: boolean     // true if the linked PO has been fully received
}

/** Net amount excl. VAT, derived from gross + vatRate */
export function invoiceNet(inv: PurchaseInvoice): number {
    return inv.amount / (1 + inv.vatRate / 100)
}

/** VAT amount derived from gross + vatRate */
export function invoiceVAT(inv: PurchaseInvoice): number {
    return inv.amount - invoiceNet(inv)
}

// ─── Credit Note Types ─────────────────────────────────────────────────────────

export type CreditNoteStatus = 'Unmatched' | 'Pending' | 'Partially Applied' | 'Applied'

export interface CreditNote {
    id: string                       // e.g. CN-STO-2026-001
    supplierCreditNumber: string | null
    originalInvoiceId: string | null // links to purchase_invoices.id
    vendor: string
    creditDate: string
    amount: number                   // full credit value (positive number)
    remainingAmount: number          // amount not yet applied
    status: CreditNoteStatus
    reason: string | null
    pdfUrl: string | null
    notes: string | null
}

export type SalesInvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'

export interface SalesInvoiceItem {
    inventoryId?: string
    name: string
    articleNumber?: string
    quantity: number
    unitPrice: number
    lineTotal: number
    size?: string
}

export interface SalesInvoice {
    id: string                // e.g. SINV-2026-001
    customerName: string
    customerEmail?: string
    customerPhone?: string
    invoiceDate: string
    dueDate: string
    totalAmount: number
    status: SalesInvoiceStatus
    notes?: string
    items: SalesInvoiceItem[]
}

export interface PurchaseOrder {
    id: string;
    vendor: string;
    date: string;
    eta: string;
    status: POStatus;
    items: POLineItem[];
    totalCost: number;
    notes?: string;
}