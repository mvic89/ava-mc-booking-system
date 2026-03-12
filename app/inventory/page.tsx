'use client'

import { useState } from 'react'
import { useInventory } from '@/context/InventoryContext'
import { Motorcycle, SparePart, Accessory, BaseInventoryItem, InventoryCategory } from '@/utils/types'
import { AddItemModal } from '@/components/AddItemModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'SEK' }).format(value)
}

function formatSEK(value: number) {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(value)
}

function StockBadge({ stock, reorderQty }: { stock: number; reorderQty: number }) {
    const isLow = stock <= reorderQty
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`} />
            {stock} units
        </span>
    )
}

/** +/− controls visible on row hover. Clicks update context → auto-POs react instantly. */
function StockCell({
    item,
    updateStock,
}: {
    item: BaseInventoryItem
    updateStock: (id: string, stock: number) => void
}) {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={(e) => { e.stopPropagation(); updateStock(item.id, item.stock - 1) }}
                title="Decrease stock"
                className="w-5 h-5 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center shrink-0"
            >
                −
            </button>
            <StockBadge stock={item.stock} reorderQty={item.reorderQty} />
            <button
                onClick={(e) => { e.stopPropagation(); updateStock(item.id, item.stock + 1) }}
                title="Increase stock"
                className="w-5 h-5 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center shrink-0"
            >
                +
            </button>
        </div>
    )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: InventoryCategory; label: string; icon: string }[] = [
    { id: 'motorcycles', label: 'Motorcycles', icon: '🏍️' },
    { id: 'spareParts',  label: 'Spare Parts',  icon: '🔧' },
    { id: 'accessories', label: 'Accessories',  icon: '🪖' },
]

// ─── Table: Motorcycles ───────────────────────────────────────────────────────

function MotorcycleTable({
    data,
    updateStock,
}: {
    data: Motorcycle[]
    updateStock: (id: string, stock: number) => void
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500 tracking-wider">
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Name / Brand</th>
                        <th className="px-4 py-3">Article No.</th>
                        <th className="px-4 py-3">VIN</th>
                        <th className="px-4 py-3">Year</th>
                        <th className="px-4 py-3">Engine</th>
                        <th className="px-4 py-3">Color</th>
                        <th className="px-4 py-3">MC Type</th>
                        <th className="px-4 py-3">Warehouse</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Reorder Qty</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Sell Price</th>
                        <th className="px-4 py-3">Margin</th>
                        <th className="px-4 py-3">Vendor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((item) => {
                        const margin = (((item.sellingPrice - item.cost) / item.sellingPrice) * 100).toFixed(1)
                        return (
                            <tr key={item.id} className="group hover:bg-orange-50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.id}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-800">{item.name}</div>
                                    <div className="text-xs text-orange-500 font-medium">{item.brand}</div>
                                    <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate" title={item.description}>{item.description}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.articleNumber}</td>
                                <td className="px-4 py-3 font-mono text-xs text-blue-600">{item.vin}</td>
                                <td className="px-4 py-3 text-gray-700">{item.year}</td>
                                <td className="px-4 py-3 text-gray-700">{item.engineCC}cc</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                                        <span className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0" style={{ background: item.color.toLowerCase().includes('black') ? '#1f2937' : item.color.toLowerCase().includes('white') ? '#f9fafb' : item.color.toLowerCase().includes('red') ? '#dc2626' : item.color.toLowerCase().includes('green') ? '#16a34a' : item.color.toLowerCase().includes('blue') ? '#2563eb' : item.color.toLowerCase().includes('yellow') || item.color.toLowerCase().includes('gold') ? '#ca8a04' : item.color.toLowerCase().includes('gray') || item.color.toLowerCase().includes('grey') ? '#6b7280' : item.color.toLowerCase().includes('orange') ? '#ea580c' : '#d1d5db' }} />
                                        {item.color}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        item.mcType === 'New'        ? 'bg-green-100 text-green-700' :
                                        item.mcType === 'Trade-In'   ? 'bg-blue-100 text-blue-700' :
                                                                       'bg-purple-100 text-purple-700'
                                    }`}>
                                        {item.mcType}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{item.warehouse}</td>
                                <td className="px-4 py-3">
                                    <StockCell item={item} updateStock={updateStock} />
                                </td>
                                <td className="px-4 py-3 text-gray-600">{item.reorderQty}</td>
                                <td className="px-4 py-3 text-gray-700">{formatSEK(item.cost)}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{formatSEK(item.sellingPrice)}</td>
                                <td className="px-4 py-3">
                                    <span className="text-green-600 font-medium">{margin}%</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 max-w-35 truncate" title={item.vendor}>{item.vendor}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ─── Table: Spare Parts ───────────────────────────────────────────────────────

function SparePartsTable({
    data,
    updateStock,
}: {
    data: SparePart[]
    updateStock: (id: string, stock: number) => void
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500 tracking-wider">
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Name / Brand</th>
                        <th className="px-4 py-3">Article No.</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Reorder Qty</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Sell Price</th>
                        <th className="px-4 py-3">Margin</th>
                        <th className="px-4 py-3">Vendor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((item) => {
                        const margin = (((item.sellingPrice - item.cost) / item.sellingPrice) * 100).toFixed(1)
                        return (
                            <tr key={item.id} className="group hover:bg-orange-50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.id}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-800">{item.name}</div>
                                    <div className="text-xs text-orange-500 font-medium">{item.brand}</div>
                                    <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate" title={item.description}>{item.description}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.articleNumber}</td>
                                <td className="px-4 py-3">
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{item.category}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <StockCell item={item} updateStock={updateStock} />
                                </td>
                                <td className="px-4 py-3 text-gray-600">{item.reorderQty}</td>
                                <td className="px-4 py-3 text-gray-700">{formatCurrency(item.cost)}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{formatCurrency(item.sellingPrice)}</td>
                                <td className="px-4 py-3">
                                    <span className="text-green-600 font-medium">{margin}%</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 max-w-35 truncate" title={item.vendor}>{item.vendor}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ─── Table: Accessories ───────────────────────────────────────────────────────

function AccessoriesTable({
    data,
    updateStock,
}: {
    data: Accessory[]
    updateStock: (id: string, stock: number) => void
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500 tracking-wider">
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Name / Brand</th>
                        <th className="px-4 py-3">Article No.</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Size</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Reorder Qty</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Sell Price</th>
                        <th className="px-4 py-3">Margin</th>
                        <th className="px-4 py-3">Vendor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((item) => {
                        const margin = (((item.sellingPrice - item.cost) / item.sellingPrice) * 100).toFixed(1)
                        return (
                            <tr key={item.id} className="group hover:bg-orange-50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.id}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-800">{item.name}</div>
                                    <div className="text-xs text-orange-500 font-medium">{item.brand}</div>
                                    <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate" title={item.description}>{item.description}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.articleNumber}</td>
                                <td className="px-4 py-3">
                                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">{item.category}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-700 font-medium">{item.size ?? '—'}</td>
                                <td className="px-4 py-3">
                                    <StockCell item={item} updateStock={updateStock} />
                                </td>
                                <td className="px-4 py-3 text-gray-600">{item.reorderQty}</td>
                                <td className="px-4 py-3 text-gray-700">{formatCurrency(item.cost)}</td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{formatCurrency(item.sellingPrice)}</td>
                                <td className="px-4 py-3">
                                    <span className="text-green-600 font-medium">{margin}%</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500 max-w-35 truncate" title={item.vendor}>{item.vendor}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ data }: { data: BaseInventoryItem[] }) {
    const totalItems = data.length
    const totalStock = data.reduce((s, i) => s + i.stock, 0)
    const lowStock   = data.filter((i) => i.stock <= i.reorderQty).length
    const totalValue = data.reduce((s, i) => s + i.sellingPrice * i.stock, 0)

    const cards = [
        { label: 'Total SKUs',        value: String(totalItems),       icon: '📦', color: 'bg-blue-50 text-blue-700'   },
        { label: 'Units in Stock',    value: String(totalStock),       icon: '🗃️', color: 'bg-green-50 text-green-700' },
        { label: 'Low Stock Alerts',  value: String(lowStock),         icon: '⚠️', color: 'bg-red-50 text-red-700'    },
        { label: 'Stock Value (Sell)', value: formatCurrency(totalValue), icon: '💰', color: 'bg-orange-50 text-orange-700' },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((c) => (
                <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
                    <div className="text-2xl mb-1">{c.icon}</div>
                    <div className="text-xs font-medium opacity-70 mb-0.5">{c.label}</div>
                    <div className="text-xl font-bold">{c.value}</div>
                </div>
            ))}
        </div>
    )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <span className="text-4xl mb-2">🔍</span>
            <p className="text-sm">No items match your search</p>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
    const { motorcycles, spareParts, accessories, updateStock, autoPOs } = useInventory()
    const [activeTab, setActiveTab]     = useState<InventoryCategory>('motorcycles')
    const [search, setSearch]           = useState('')
    const [showAddModal, setShowAddModal] = useState(false)

    const q = search.toLowerCase()

    const filteredMotorcycles = motorcycles.filter((m) =>
        [m.name, m.brand, m.articleNumber, m.vin, m.vendor].some((f) => f.toLowerCase().includes(q))
    )
    const filteredSpareParts = spareParts.filter((s) =>
        [s.name, s.brand, s.articleNumber, s.category, s.vendor].some((f) => f.toLowerCase().includes(q))
    )
    const filteredAccessories = accessories.filter((a) =>
        [a.name, a.brand, a.articleNumber, a.category, a.vendor, a.size ?? ''].some((f) => f.toLowerCase().includes(q))
    )

    const counts: Record<InventoryCategory, number> = {
        motorcycles: filteredMotorcycles.length,
        spareParts:  filteredSpareParts.length,
        accessories: filteredAccessories.length,
    }

    const activeData: BaseInventoryItem[] =
        activeTab === 'motorcycles' ? motorcycles :
        activeTab === 'spareParts'  ? spareParts  : accessories

    const pendingPOs = autoPOs.filter((p) => p.status === 'Under Review').length

    return (
        <div className="lg:ml-64 min-h-screen p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Hover any row to adjust stock — POs update instantly
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {pendingPOs > 0 && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full">
                            ⚠️ {pendingPOs} PO{pendingPOs > 1 ? 's' : ''} pending approval
                        </span>
                    )}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                        + Add Item
                    </button>
                </div>
            </div>

            {/* Summary Cards — driven by live context state */}
            <SummaryCards data={activeData} />

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-white text-gray-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                                activeTab === tab.id ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'
                            }`}>
                                {counts[tab.id]}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="ml-auto">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input
                            type="text"
                            placeholder="Search inventory..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto">
                {activeTab === 'motorcycles' && (
                    filteredMotorcycles.length > 0
                        ? <MotorcycleTable data={filteredMotorcycles} updateStock={updateStock} />
                        : <EmptyState />
                )}
                {activeTab === 'spareParts' && (
                    filteredSpareParts.length > 0
                        ? <SparePartsTable data={filteredSpareParts} updateStock={updateStock} />
                        : <EmptyState />
                )}
                {activeTab === 'accessories' && (
                    filteredAccessories.length > 0
                        ? <AccessoriesTable data={filteredAccessories} updateStock={updateStock} />
                        : <EmptyState />
                )}
            </div>

            {/* Add Item Modal */}
            {showAddModal && (
                <AddItemModal onClose={() => setShowAddModal(false)} />
            )}
        </div>
    )
}
