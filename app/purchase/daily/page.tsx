'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { getDealershipId } from '@/lib/tenant'
import { useInventory } from '@/context/InventoryContext'
import { formatCurrency } from '@/components/POModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function businessDaysSince(isoDate: string): number {
    const start = new Date(isoDate)
    const now   = new Date()
    let days = 0
    const cur = new Date(start)
    while (cur < now) {
        cur.setDate(cur.getDate() + 1)
        const dow = cur.getDay()
        if (dow !== 0 && dow !== 6) days++
    }
    return days
}

const isValidDate = (s: string | null | undefined): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

function dayDiff(a: string, b: string): number {
    return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionPO = {
    id:              string
    vendor:          string
    eta:             string | null
    status:          string
    total_cost:      number
    placed_at:       string | null
    approval_status: string | null
    date:            string
}

type PendingReceipt = {
    id:            string
    vendor:        string
    received_date: string
    po_id:         string | null
    unit_count:    number
}

type OverdueInvoice = {
    id:          string
    vendor:      string
    due_date:    string
    amount:      number
    status:      string
}

// ── Section component ─────────────────────────────────────────────────────────

function ActionSection({
    icon, title, count, color, borderColor, emptyText, href, children,
}: {
    icon:        string
    title:       string
    count:       number
    color:       string
    borderColor: string
    emptyText:   string
    href:        string
    children:    React.ReactNode
}) {
    return (
        <div className={`bg-white border border-gray-200 border-l-4 ${borderColor} rounded-xl shadow-sm overflow-hidden`}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-sm font-bold text-gray-800">{title}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{count}</span>
                </div>
                <Link href={href} className="text-xs text-orange-500 hover:text-orange-700 font-semibold">
                    View all →
                </Link>
            </div>
            <div className="divide-y divide-gray-50">
                {count === 0
                    ? <p className="text-xs text-gray-400 px-5 py-4 italic">{emptyText}</p>
                    : children
                }
            </div>
        </div>
    )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DailyActionDashboard() {
    const { lowStockAlerts } = useInventory()

    const [pos,              setPOs]             = useState<ActionPO[]>([])
    const [pendingReceipts,  setPendingReceipts] = useState<PendingReceipt[]>([])
    const [overdueInvoices,  setOverdueInvoices] = useState<OverdueInvoice[]>([])
    const [loading,          setLoading]         = useState(true)

    const today = useMemo(() => new Date().toISOString().split('T')[0], [])

    useEffect(() => {
        async function load() {
            const dealershipId = getDealershipId()
            if (!dealershipId) { setLoading(false); return }

            const [{ data: poData }, { data: grData }, { data: invData }] = await Promise.all([
                supabase
                    .from('purchase_orders')
                    .select('id, vendor, eta, status, total_cost, placed_at, approval_status, date')
                    .eq('dealership_id', dealershipId)
                    .in('status', ['Sent', 'Partial', 'Reviewed', 'Draft']),

                supabase
                    .from('goods_receipts')
                    .select('id, vendor, received_date, po_id')
                    .eq('dealership_id', dealershipId)
                    .eq('status', 'pending_approval'),

                supabase
                    .from('purchase_invoices')
                    .select('id, vendor, due_date, amount, status')
                    .eq('dealership_id', dealershipId)
                    .eq('status', 'Overdue'),
            ])

            setPOs((poData ?? []) as ActionPO[])
            setOverdueInvoices((invData ?? []) as OverdueInvoice[])

            // Enrich goods receipts with unit counts
            if (grData && grData.length > 0) {
                const ids = grData.map(r => r.id)
                const { data: items } = await supabase
                    .from('goods_receipt_items')
                    .select('receipt_id, received_qty')
                    .in('receipt_id', ids)

                setPendingReceipts(grData.map(r => ({
                    ...r,
                    unit_count: (items ?? [])
                        .filter(i => i.receipt_id === r.id)
                        .reduce((s, i) => s + (i.received_qty ?? 0), 0),
                })))
            }

            setLoading(false)
        }
        load()
    }, [])

    // ── Action groups ─────────────────────────────────────────────────────────

    const followUpPOs = pos.filter(po =>
        po.status === 'Sent' && po.placed_at && businessDaysSince(po.placed_at) >= 5
    )
    const etaOverduePOs = pos.filter(po =>
        po.status === 'Sent' && isValidDate(po.eta) && po.eta < today
    )
    const arrivingTodayPOs = pos.filter(po =>
        po.status === 'Sent' && po.eta === today
    )
    const pendingApprovalPOs = pos.filter(po =>
        po.approval_status === 'pending_approval'
    )
    const partialPOs = pos.filter(po => po.status === 'Partial')

    const totalActions =
        followUpPOs.length +
        etaOverduePOs.length +
        pendingApprovalPOs.length +
        pendingReceipts.length +
        overdueInvoices.length +
        partialPOs.length +
        lowStockAlerts.length

    const dateLabel = new Date().toLocaleDateString('en-SE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    if (loading) {
        return (
            <div className="flex min-h-screen">
                <Sidebar />
                <div className="lg:ml-64 flex-1 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-[#f5f7fa]">
            <Sidebar />
            <div className="lg:ml-64 flex-1 flex flex-col min-h-0">

                {/* Top bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Link href="/purchase" className="hover:text-orange-500 transition-colors font-medium">
                            Purchase
                        </Link>
                        <span>/</span>
                        <span className="text-gray-800 font-semibold">Daily Actions</span>
                    </div>
                    <span className="text-xs text-gray-400">{dateLabel}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6">

                    {/* Hero */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-black text-gray-900">Daily Action Dashboard</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Everything that needs attention today.</p>
                    </div>

                    {/* Summary strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {[
                            { label: 'Total Actions',      value: totalActions,                            color: totalActions > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200' },
                            { label: 'Urgent',             value: followUpPOs.length + etaOverduePOs.length + overdueInvoices.length, color: 'bg-red-50 text-red-700 border-red-200' },
                            { label: 'Pending Approval',   value: pendingApprovalPOs.length + pendingReceipts.length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                            { label: 'Low Stock',          value: lowStockAlerts.length,                   color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        ].map(c => (
                            <div key={c.label} className={`border rounded-xl px-4 py-3 ${c.color}`}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
                                <p className="text-2xl font-black mt-0.5">{c.value}</p>
                            </div>
                        ))}
                    </div>

                    {totalActions === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                            <span className="text-5xl">✅</span>
                            <p className="text-lg font-bold text-gray-700">All clear — nothing needs attention today!</p>
                            <p className="text-sm text-gray-400">Check back tomorrow or after new POs are placed.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                        {/* 1. Follow Up Now */}
                        <ActionSection
                            icon="🔴" title="Follow Up Now" count={followUpPOs.length}
                            color="bg-red-100 text-red-700" borderColor="border-l-red-500"
                            emptyText="No overdue follow-ups — all sent POs are within 5 business days."
                            href="/purchase"
                        >
                            {followUpPOs.slice(0, 5).map(po => (
                                <Link key={po.id} href="/purchase"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-red-50 transition-colors group"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 font-mono">{po.id}</p>
                                        <p className="text-xs text-gray-500 truncate">{po.vendor}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap ml-3 shrink-0">
                                        {po.placed_at ? businessDaysSince(po.placed_at) : '?'}d overdue
                                    </span>
                                </Link>
                            ))}
                        </ActionSection>

                        {/* 2. ETA Overdue */}
                        <ActionSection
                            icon="⚠️" title="ETA Overdue" count={etaOverduePOs.length}
                            color="bg-orange-100 text-orange-700" borderColor="border-l-orange-500"
                            emptyText="No POs past their expected arrival date."
                            href="/purchase"
                        >
                            {etaOverduePOs.slice(0, 5).map(po => (
                                <Link key={po.id} href="/purchase"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-orange-50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 font-mono">{po.id}</p>
                                        <p className="text-xs text-gray-500 truncate">{po.vendor}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap ml-3 shrink-0">
                                        ETA was {formatDate(po.eta!)} ({Math.abs(dayDiff(today, po.eta!))}d ago)
                                    </span>
                                </Link>
                            ))}
                        </ActionSection>

                        {/* 3. Arriving Today */}
                        {arrivingTodayPOs.length > 0 && (
                            <ActionSection
                                icon="📅" title="Arriving Today" count={arrivingTodayPOs.length}
                                color="bg-blue-100 text-blue-700" borderColor="border-l-blue-500"
                                emptyText=""
                                href="/purchase"
                            >
                                {arrivingTodayPOs.map(po => (
                                    <Link key={po.id} href="/purchase"
                                        className="flex items-center justify-between px-5 py-3 hover:bg-blue-50 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-800 font-mono">{po.id}</p>
                                            <p className="text-xs text-gray-500 truncate">{po.vendor}</p>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-3 shrink-0">
                                            {formatCurrency(po.total_cost)}
                                        </span>
                                    </Link>
                                ))}
                            </ActionSection>
                        )}

                        {/* 4. Pending PO Approval */}
                        <ActionSection
                            icon="🔐" title="POs Awaiting Approval" count={pendingApprovalPOs.length}
                            color="bg-amber-100 text-amber-700" borderColor="border-l-amber-500"
                            emptyText="No POs waiting for approval."
                            href="/purchase"
                        >
                            {pendingApprovalPOs.slice(0, 5).map(po => (
                                <Link key={po.id} href="/purchase"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-amber-50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 font-mono">{po.id}</p>
                                        <p className="text-xs text-gray-500 truncate">{po.vendor}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-3 shrink-0">
                                        {formatCurrency(po.total_cost)}
                                    </span>
                                </Link>
                            ))}
                        </ActionSection>

                        {/* 5. Goods Receipts Pending */}
                        <ActionSection
                            icon="📬" title="Receipts to Approve" count={pendingReceipts.length}
                            color="bg-purple-100 text-purple-700" borderColor="border-l-purple-500"
                            emptyText="No delivery notes waiting for approval."
                            href="/goods-receipts"
                        >
                            {pendingReceipts.slice(0, 5).map(r => (
                                <Link key={r.id} href="/goods-receipts"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-purple-50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 font-mono">{r.id}</p>
                                        <p className="text-xs text-gray-500 truncate">{r.vendor}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 ml-3 shrink-0">
                                        {r.unit_count} units · {formatDate(r.received_date)}
                                    </span>
                                </Link>
                            ))}
                        </ActionSection>

                        {/* 6. Overdue Invoices */}
                        <ActionSection
                            icon="💸" title="Overdue Invoices" count={overdueInvoices.length}
                            color="bg-red-100 text-red-700" borderColor="border-l-red-400"
                            emptyText="No overdue supplier invoices."
                            href="/purchaseinvoice"
                        >
                            {overdueInvoices.slice(0, 5).map(inv => (
                                <Link key={inv.id} href="/purchaseinvoice"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-red-50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 font-mono">{inv.id}</p>
                                        <p className="text-xs text-gray-500 truncate">{inv.vendor}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 shrink-0">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                            Due {isValidDate(inv.due_date) ? formatDate(inv.due_date) : inv.due_date}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-700">{formatCurrency(inv.amount)}</span>
                                    </div>
                                </Link>
                            ))}
                        </ActionSection>

                        {/* 7. Backorders */}
                        <ActionSection
                            icon="🔄" title="Partial Orders" count={partialPOs.length}
                            color="bg-gray-100 text-gray-600" borderColor="border-l-gray-400"
                            emptyText="No POs with outstanding backorders."
                            href="/purchase"
                        >
                            {partialPOs.slice(0, 5).map(po => (
                                <Link key={po.id} href="/purchase"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 font-mono">{po.id}</p>
                                        <p className="text-xs text-gray-500 truncate">{po.vendor}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 ml-3 shrink-0">
                                        Partial
                                    </span>
                                </Link>
                            ))}
                        </ActionSection>

                        {/* 8. Low Stock */}
                        <ActionSection
                            icon="📦" title="Low Stock — Reorder Needed" count={lowStockAlerts.length}
                            color="bg-blue-100 text-blue-700" borderColor="border-l-blue-400"
                            emptyText="All items are above reorder level."
                            href="/inventory/low-stock"
                        >
                            {lowStockAlerts.slice(0, 5).map(item => (
                                <Link key={item.inventoryId} href="/inventory/low-stock"
                                    className="flex items-center justify-between px-5 py-3 hover:bg-blue-50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{item.vendor ?? 'No vendor'}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-3 shrink-0">
                                        Stock: {item.currentStock} / Min: {item.reorderQty}
                                    </span>
                                </Link>
                            ))}
                        </ActionSection>

                    </div>
                </div>
            </div>
        </div>
    )
}
