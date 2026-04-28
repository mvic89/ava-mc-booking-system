'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { getDealershipId } from '@/lib/tenant'

export default function EmailSettingsPage() {
    const router = useRouter()
    const t      = useTranslations('settingsEmail')
    const [replyTo,  setReplyTo]  = useState('')
    const [phone,    setPhone]    = useState('')
    const [saving,   setSaving]   = useState(false)
    const [saved,    setSaved]    = useState(false)
    const [loaded,   setLoaded]   = useState(false)

    useEffect(() => {
        const raw = localStorage.getItem('user')
        if (!raw) { router.push('/auth/login'); return }
        const u = JSON.parse(raw)
        if (u.role !== 'admin') { router.push('/settings'); return }

        async function load() {
            const id = getDealershipId()
            if (!id) return
            const { data } = await supabase
                .from('dealerships')
                .select('email, phone')
                .eq('id', id)
                .single()
            if (data) {
                setReplyTo(data.email ?? '')
                setPhone(data.phone ?? '')
            }
            setLoaded(true)
        }
        load()
    }, [router])

    async function handleSave() {
        setSaving(true)
        setSaved(false)
        const id = getDealershipId()
        if (!id) return
        await supabase.from('dealerships').update({
            email: replyTo || null,
            phone: phone   || null,
        }).eq('id', id)
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    return (
        <div className="flex min-h-screen bg-[#f5f7fa]">
            <Sidebar />
            <div className="lg:ml-64 flex-1">
                <div className="brand-top-bar" />
                <div className="p-6 max-w-2xl animate-fade-up">

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
                        <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">{t('breadcrumb')}</Link>
                        <span>/</span>
                        <span className="text-slate-600 font-medium">{t('title')}</span>
                    </div>

                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-xl">✉️</div>
                            <div>
                                <h1 className="text-xl font-black text-[#0b1524]">{t('title')}</h1>
                                <p className="text-xs text-slate-500">{t('subtitle')}</p>
                            </div>
                        </div>
                    </div>

                    {/* How it works */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                            <span className="text-base">⚡</span>
                            <p className="text-sm font-bold text-slate-800">Powered by Resend</p>
                            <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">Active</span>
                        </div>
                        <div className="px-6 py-4 flex flex-col gap-3">
                            {[
                                { icon: '📤', title: 'You send a PO',         desc: 'Email goes out from the platform address via Resend.' },
                                { icon: '📬', title: 'Vendor receives it',     desc: 'They see your dealership name, PO number, and the PDF attached.' },
                                { icon: '↩️', title: 'Vendor replies',         desc: 'Their reply lands in your inbox — the Reply-To is your email below.' },
                            ].map(step => (
                                <div key={step.title} className="flex items-start gap-3">
                                    <span className="text-lg shrink-0">{step.icon}</span>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">{step.title}</p>
                                        <p className="text-xs text-slate-400">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Reply-To config */}
                    {!loaded ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 text-sm">{t('loading')}</div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">

                            <div className="px-6 py-5">
                                <label className="block text-sm font-bold text-slate-800 mb-1">
                                    {t('replyToLabel')}
                                </label>
                                <p className="text-xs text-slate-400 mb-3">{t('replyToDesc')}</p>
                                <input
                                    type="email"
                                    placeholder="you@yourdealership.com"
                                    value={replyTo}
                                    onChange={e => setReplyTo(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 transition"
                                />
                            </div>

                            <div className="px-6 py-5">
                                <label className="block text-sm font-bold text-slate-800 mb-1">
                                    {t('phoneLabel')}
                                </label>
                                <p className="text-xs text-slate-400 mb-3">{t('phoneDesc')}</p>
                                <input
                                    type="tel"
                                    placeholder="+1 555 123 4567"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 transition"
                                />
                            </div>

                            <div className="px-6 py-5 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-8 py-2.5 bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    {saving ? (
                                        <>
                                            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('saving')}
                                        </>
                                    ) : saved ? `✓ ${t('saved')}` : t('save')}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
