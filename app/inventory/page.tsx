'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useInventory } from '@/context/InventoryContext'
import { Motorcycle, SparePart, Accessory, BaseInventoryItem, InventoryCategory } from '@/utils/types'
import { AddItemModal } from '@/components/AddItemModal'
import { ImportInventoryModal } from '@/components/ImportInventoryModal'
import { EditItemModal } from '@/components/EditItemModal'
import Sidebar from '@/components/Sidebar'

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

// ─── Table: Motorcycles ───────────────────────────────────────────────────────

function MotorcycleTable({
    data, updateStock, onRowClick, onDelete,
}: {
    data: Motorcycle[]
    updateStock: (id: string, stock: number) => void
    onRowClick: (item: Motorcycle) => void
    onDelete:   (id: string) => void
}) {
    const t = useTranslations('inventory')
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 tracking-wider font-semibold">
                        <th className="px-4 py-3">{t('table.id')}</th>
                        <th className="px-4 py-3">{t('table.name')}</th>
                        <th className="px-4 py-3">{t('table.articleNo')}</th>
                        <th className="px-4 py-3">{t('table.vin')}</th>
                        <th className="px-4 py-3">{t('table.year')}</th>
                        <th className="px-4 py-3">{t('table.engine')}</th>
                        <th className="px-4 py-3">{t('table.color')}</th>
                        <th className="px-4 py-3">{t('table.mcType')}</th>
                        <th className="px-4 py-3">{t('table.warehouse')}</th>
                        <th className="px-4 py-3">{t('table.stock')}</th>
                        <th className="px-4 py-3">{t('table.reorderQty')}</th>
                        <th className="px-4 py-3">{t('table.cost')}</th>
                        <th className="px-4 py-3">{t('table.sellPrice')}</th>
                        <th className="px-4 py-3">{t('table.margin')}</th>
                        <th className="px-4 py-3">{t('table.vendor')}</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.map((item) => {
                        const margin = (((item.sellingPrice - item.cost) / item.sellingPrice) * 100).toFixed(1)
                        return (
                            <tr key={item.id} onClick={() => onRowClick(item)} className="group hover:bg-[#FF6B2C]/5 transition-colors cursor-pointer">
                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.id}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-800">{item.name}</div>
                                    <div className="text-xs text-[#FF6B2C] font-medium">{item.brand}</div>
                                    <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={item.description}>{item.description}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.articleNumber}</td>
                                <td className="px-4 py-3 font-mono text-xs text-blue-600">{item.vin}</td>
                                <td className="px-4 py-3 text-slate-700">{item.year}</td>
                                <td className="px-4 py-3 text-slate-700">{item.engineCC}cc</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                                        <span className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0" style={{ background: item.color.toLowerCase().includes('black') ? '#1f2937' : item.color.toLowerCase().includes('white') ? '#f9fafb' : item.color.toLowerCase().includes('red') ? '#dc2626' : item.color.toLowerCase().includes('green') ? '#16a34a' : item.color.toLowerCase().includes('blue') ? '#2563eb' : item.color.toLowerCase().includes('yellow') || item.color.toLowerCase().includes('gold') ? '#ca8a04' : item.color.toLowerCase().includes('gray') || item.color.toLowerCase().includes('grey') ? '#6b7280' : item.color.toLowerCase().includes('orange') ? '#ea580c' : '#d1d5db' }} />
                                        {item.color}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        item.mcType === 'New'        ? 'bg-green-100 text-green-700' :
                                        item.mcType === 'Trade-In'   ? 'bg-blue-100 text-blue-700' :
                                                                       'bg-purple-100 text-purple-700'
                                    }`}>{item.mcType}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{item.warehouse}</td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <StockCell item={item} updateStock={updateStock} />
                                </td>
                                <td className="px-4 py-3 text-slate-500">{item.reorderQty}</td>
                                <td className="px-4 py-3 text-slate-700">{formatSEK(item.cost)}</td>
                                <td className="px-4 py-3 font-semibold text-slate-900">{formatSEK(item.sellingPrice)}</td>
                                <td className="px-4 py-3"><span className="text-green-600 font-medium">{margin}%</span></td>
                                <td className="px-4 py-3 text-xs text-slate-400 max-w-35 truncate" title={item.vendor}>{item.vendor}</td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
                                </td>
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
    data, updateStock, onRowClick, onDelete,
}: {
    data: SparePart[]
    updateStock: (id: string, stock: number) => void
    onRowClick: (item: SparePart) => void
    onDelete:   (id: string) => void
}) {
    const t = useTranslations('inventory')
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 tracking-wider font-semibold">
                        <th className="px-4 py-3">{t('table.id')}</th>
                        <th className="px-4 py-3">{t('table.name')}</th>
                        <th className="px-4 py-3">{t('table.articleNo')}</th>
                        <th className="px-4 py-3">{t('table.mcType')}</th>
                        <th className="px-4 py-3">{t('table.stock')}</th>
                        <th className="px-4 py-3">{t('table.reorderQty')}</th>
                        <th className="px-4 py-3">{t('table.cost')}</th>
                        <th className="px-4 py-3">{t('table.sellPrice')}</th>
                        <th className="px-4 py-3">{t('table.margin')}</th>
                        <th className="px-4 py-3">{t('table.vendor')}</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.map((item) => {
                        const margin = (((item.sellingPrice - item.cost) / item.sellingPrice) * 100).toFixed(1)
                        return (
                            <tr key={item.id} onClick={() => onRowClick(item)} className="group hover:bg-[#FF6B2C]/5 transition-colors cursor-pointer">
                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.id}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-800">{item.name}</div>
                                    <div className="text-xs text-[#FF6B2C] font-medium">{item.brand}</div>
                                    <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={item.description}>{item.description}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.articleNumber}</td>
                                <td className="px-4 py-3">
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{item.category}</span>
                                </td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <StockCell item={item} updateStock={updateStock} />
                                </td>
                                <td className="px-4 py-3 text-slate-500">{item.reorderQty}</td>
                                <td className="px-4 py-3 text-slate-700">{formatCurrency(item.cost)}</td>
                                <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(item.sellingPrice)}</td>
                                <td className="px-4 py-3"><span className="text-green-600 font-medium">{margin}%</span></td>
                                <td className="px-4 py-3 text-xs text-slate-400 max-w-35 truncate" title={item.vendor}>{item.vendor}</td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
                                </td>
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
    data, updateStock, onRowClick, onDelete,
}: {
    data: Accessory[]
    updateStock: (id: string, stock: number) => void
    onRowClick: (item: Accessory) => void
    onDelete:   (id: string) => void
}) {
    const t = useTranslations('inventory')
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 tracking-wider font-semibold">
                        <th className="px-4 py-3">{t('table.id')}</th>
                        <th className="px-4 py-3">{t('table.name')}</th>
                        <th className="px-4 py-3">{t('table.articleNo')}</th>
                        <th className="px-4 py-3">{t('table.mcType')}</th>
                        <th className="px-4 py-3">{t('table.color')}</th>
                        <th className="px-4 py-3">{t('table.stock')}</th>
                        <th className="px-4 py-3">{t('table.reorderQty')}</th>
                        <th className="px-4 py-3">{t('table.cost')}</th>
                        <th className="px-4 py-3">{t('table.sellPrice')}</th>
                        <th className="px-4 py-3">{t('table.margin')}</th>
                        <th className="px-4 py-3">{t('table.vendor')}</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {data.map((item) => {
                        const margin = (((item.sellingPrice - item.cost) / item.sellingPrice) * 100).toFixed(1)
                        return (
                            <tr key={item.id} onClick={() => onRowClick(item)} className="group hover:bg-[#FF6B2C]/5 transition-colors cursor-pointer">
                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.id}</td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-800">{item.name}</div>
                                    <div className="text-xs text-[#FF6B2C] font-medium">{item.brand}</div>
                                    <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={item.description}>{item.description}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.articleNumber}</td>
                                <td className="px-4 py-3">
                                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">{item.category}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-700 font-medium">{item.size ?? '—'}</td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <StockCell item={item} updateStock={updateStock} />
                                </td>
                                <td className="px-4 py-3 text-slate-500">{item.reorderQty}</td>
                                <td className="px-4 py-3 text-slate-700">{formatCurrency(item.cost)}</td>
                                <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(item.sellingPrice)}</td>
                                <td className="px-4 py-3"><span className="text-green-600 font-medium">{margin}%</span></td>
                                <td className="px-4 py-3 text-xs text-slate-400 max-w-35 truncate" title={item.vendor}>{item.vendor}</td>
                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm" title="Delete">🗑️</button>
                                </td>
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
    const t          = useTranslations('inventory')
    const totalItems = data.length
    const totalStock = data.reduce((s, i) => s + i.stock, 0)
    const lowStock   = data.filter((i) => i.stock <= i.reorderQty).length
    const totalValue = data.reduce((s, i) => s + i.sellingPrice * i.stock, 0)

    const cards = [
        { label: t('stats.totalSkus'),    value: String(totalItems),         icon: '📦', color: 'text-[#FF6B2C]' },
        { label: t('stats.unitsInStock'), value: String(totalStock),         icon: '🗃️', color: 'text-green-600' },
        { label: t('stats.lowStock'),     value: String(lowStock),           icon: '⚠️', color: 'text-red-600'   },
        { label: t('stats.stockValue'),   value: formatCurrency(totalValue), icon: '💰', color: 'text-slate-900' },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
                <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
                    <span className="text-2xl">{c.icon}</span>
                    <div>
                        <p className={`text-xl font-extrabold ${c.color}`}>{c.value}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{c.label}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onImport, isFiltered }: { onImport: () => void; isFiltered: boolean }) {
    const t = useTranslations('inventory')
    if (isFiltered) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <span className="text-4xl mb-2">🔍</span>
                <p className="text-sm font-medium">{t('noMatch')}</p>
            </div>
        )
    }
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <span className="text-5xl">📦</span>
            <div className="text-center">
                <p className="text-slate-700 font-semibold">{t('empty')}</p>
                <p className="text-slate-400 text-sm mt-1">{t('import')}</p>
            </div>
            <button
                onClick={onImport}
                className="bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
                ⬆ {t('import')}
            </button>
        </div>
    )
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadExcel(data: BaseInventoryItem[], tabName: string) {
    import('xlsx').then((XLSX) => {
        const rows = data.map((item) => {
            const base: Record<string, unknown> = {
                ID:              item.id,
                Name:            item.name,
                Brand:           item.brand,
                'Article No.':   item.articleNumber,
                Stock:           item.stock,
                'Reorder Qty':   item.reorderQty,
                'Cost (SEK)':    item.cost,
                'Sell Price (SEK)': item.sellingPrice,
                Vendor:          item.vendor,
            }
            const mc = item as Motorcycle
            if (mc.vin)      base['VIN']       = mc.vin
            if (mc.year)     base['Year']      = mc.year
            if (mc.engineCC) base['Engine CC'] = mc.engineCC
            if (mc.color)    base['Color']     = mc.color
            if (mc.mcType)   base['MC Type']   = mc.mcType
            if (mc.warehouse)base['Warehouse'] = mc.warehouse
            const acc = item as Accessory
            if (acc.size)    base['Size']      = acc.size
            return base
        })
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, tabName)
        XLSX.writeFile(wb, `inventory_${tabName}_${new Date().toISOString().split('T')[0]}.xlsx`)
    })
}

async function downloadInventoryPDF(data: BaseInventoryItem[], tabName: string) {
    const { default: jsPDF }    = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const navy  = [30, 58, 95] as [number, number, number]

    doc.setFillColor(...navy)
    doc.rect(0, 0, pageW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('INVENTORY REPORT', 14, 14)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(147, 197, 253)
    doc.text(`${tabName} · ${data.length} items · ${new Date().toLocaleDateString('en-GB')}`, pageW - 14, 14, { align: 'right' })

    autoTable(doc, {
        startY: 28,
        head: [['ID', 'Name', 'Brand', 'Article No.', 'Stock', 'Reorder', 'Cost', 'Sell Price', 'Vendor']],
        body: data.map(i => [
            i.id, i.name, i.brand, i.articleNumber,
            i.stock, i.reorderQty,
            i.cost.toLocaleString('sv-SE'),
            i.sellingPrice.toLocaleString('sv-SE'),
            i.vendor,
        ]),
        headStyles:  { fillColor: navy, fontSize: 7, fontStyle: 'bold' },
        bodyStyles:  { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 22 }, 8: { cellWidth: 35 } },
        margin: { left: 14, right: 14 },
    })

    doc.save(`inventory_${tabName}_${new Date().toISOString().split('T')[0]}.pdf`)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
    const t = useTranslations('inventory')
    const { motorcycles, spareParts, accessories, updateStock, deleteItem, autoPOs } = useInventory()
    const [activeTab, setActiveTab]     = useState<InventoryCategory>('motorcycles')

    const TABS: { id: InventoryCategory; label: string; icon: string }[] = [
        { id: 'motorcycles', label: t('tabs.motorcycles'), icon: '🏍️' },
        { id: 'spareParts',  label: t('tabs.spareParts'),  icon: '🔧' },
        { id: 'accessories', label: t('tabs.accessories'), icon: '🪖' },
    ]
    const [search, setSearch]           = useState('')
    const [showAddModal,    setShowAddModal]    = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showDownload,    setShowDownload]    = useState(false)
    const [selectedItem,    setSelectedItem]    = useState<Motorcycle | SparePart | Accessory | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<InventoryCategory>('motorcycles')

    function handleRowClick(item: Motorcycle | SparePart | Accessory, category: InventoryCategory) {
        setSelectedItem(item)
        setSelectedCategory(category)
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this item permanently? This cannot be undone.')) return
        await deleteItem(id)
    }

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

    const pendingPOs = autoPOs.filter((p) => p.status === 'Draft').length

    return (
        <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 min-h-screen bg-[#f5f7fa] flex flex-col w-full">
            <div className="brand-top-bar" />

            {/* Header */}
            <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{t('breadcrumb')}</p>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            🏍 {t('title')}
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">{t('hint')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {pendingPOs > 0 && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full">
                                ⚠️ {pendingPOs} PO{pendingPOs > 1 ? 's' : ''} pending
                            </span>
                        )}
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
                        >
                            ⬆ Import Excel
                        </button>

                        {/* Download dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowDownload(v => !v)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
                            >
                                ⬇ Download
                                <span className="text-slate-400 text-xs">▾</span>
                            </button>
                            {showDownload && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowDownload(false)} />
                                    <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-48 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-slate-100">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                {activeTab === 'motorcycles' ? 'Motorcycles' : activeTab === 'spareParts' ? 'Spare Parts' : 'Accessories'} · {
                                                    activeTab === 'motorcycles' ? filteredMotorcycles.length :
                                                    activeTab === 'spareParts'  ? filteredSpareParts.length  : filteredAccessories.length
                                                } items
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const d = activeTab === 'motorcycles' ? filteredMotorcycles : activeTab === 'spareParts' ? filteredSpareParts : filteredAccessories
                                                downloadExcel(d, activeTab)
                                                setShowDownload(false)
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] transition-colors"
                                        >
                                            <span className="text-base">📊</span>
                                            <div className="text-left">
                                                <div className="font-semibold text-xs">Excel (.xlsx)</div>
                                                <div className="text-[10px] text-slate-400">Spreadsheet format</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const d = activeTab === 'motorcycles' ? filteredMotorcycles : activeTab === 'spareParts' ? filteredSpareParts : filteredAccessories
                                                downloadInventoryPDF(d, activeTab)
                                                setShowDownload(false)
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#FF6B2C]/5 hover:text-[#FF6B2C] transition-colors"
                                        >
                                            <span className="text-base">📄</span>
                                            <div className="text-left">
                                                <div className="font-semibold text-xs">PDF</div>
                                                <div className="text-[10px] text-slate-400">Print-ready format</div>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                        >
                            + Add Item
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 px-5 md:px-8 py-6 space-y-5">

            {/* Summary Cards — driven by live context state */}
            <SummaryCards data={activeData} />

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                                activeTab === tab.id ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]' : 'bg-slate-200 text-slate-500'
                            }`}>
                                {counts[tab.id]}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="ml-auto">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder={t('search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]/50 w-64 bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-auto">
                {activeTab === 'motorcycles' && (
                    filteredMotorcycles.length > 0
                        ? <MotorcycleTable data={filteredMotorcycles} updateStock={updateStock} onRowClick={item => handleRowClick(item, 'motorcycles')} onDelete={handleDelete} />
                        : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== ''} />
                )}
                {activeTab === 'spareParts' && (
                    filteredSpareParts.length > 0
                        ? <SparePartsTable data={filteredSpareParts} updateStock={updateStock} onRowClick={item => handleRowClick(item, 'spareParts')} onDelete={handleDelete} />
                        : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== ''} />
                )}
                {activeTab === 'accessories' && (
                    filteredAccessories.length > 0
                        ? <AccessoriesTable data={filteredAccessories} updateStock={updateStock} onRowClick={item => handleRowClick(item, 'accessories')} onDelete={handleDelete} />
                        : <EmptyState onImport={() => setShowImportModal(true)} isFiltered={search !== ''} />
                )}
            </div>

            </div>{/* end flex-1 px-5 */}

            {/* Add Item Modal */}
            {showAddModal && (
                <AddItemModal onClose={() => setShowAddModal(false)} />
            )}

            {/* Import Modal */}
            {showImportModal && (
                <ImportInventoryModal onClose={() => setShowImportModal(false)} />
            )}

            {/* Edit Item Modal */}
            {selectedItem && (
                <EditItemModal
                    item={selectedItem}
                    category={selectedCategory}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
        </div>
    )
}