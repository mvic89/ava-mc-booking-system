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
    category: 'Engine' | 'Brakes' | 'Electrical' | 'Transmission' | 'Suspension' | 'Fuel System' | 'Tyres & Wheels' | 'Exhaust' | 'Body & Frame';
}

export interface Accessory extends BaseInventoryItem {
    category: 'Helmet' | 'Gloves' | 'Jacket' | 'Boots' | 'Pants' | 'Protection' | 'Luggage' | 'Handlebars & Grips' | 'Cap' | 'Neck & Face';
    size?: string;
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

export type PurchaseInvoiceStatus = 'Pending' | 'Paid' | 'Overdue' | 'Disputed'

export interface PurchaseInvoice {
    id: string                    // e.g. PINV-2026-001
    supplierInvoiceNumber: string // supplier's own invoice reference
    poId?: string                 // linked PO, if any
    vendor: string
    invoiceDate: string           // ISO date string
    dueDate: string
    amount: number
    status: PurchaseInvoiceStatus
    notes?: string
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