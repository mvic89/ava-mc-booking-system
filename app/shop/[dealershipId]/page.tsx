import { getSupabaseServer } from '@/lib/supabase'
import { notFound } from 'next/navigation'

export const revalidate = 60 // ISR: re-fetch at most once per minute

interface Props {
    params: Promise<{ dealershipId: string }>
}

export default async function ShopPage({ params }: Props) {
    const { dealershipId } = await params
    const sb = getSupabaseServer()

    const [dealerRes, mcsRes, spsRes, accsRes] = await Promise.all([
        sb.from('dealerships').select('name, website').eq('id', dealershipId).single(),
        sb.from('motorcycles').select('id, name, brand, selling_price, images, year, engine_cc, color, description').eq('dealership_id', dealershipId).eq('listed_on_website', true).order('name'),
        sb.from('spare_parts').select('id, name, brand, selling_price, images, category, description').eq('dealership_id', dealershipId).eq('listed_on_website', true).order('name'),
        sb.from('accessories').select('id, name, brand, selling_price, images, category, size, color, description').eq('dealership_id', dealershipId).eq('listed_on_website', true).order('name'),
    ])

    if (!dealerRes.data) notFound()

    const dealer = dealerRes.data
    const motorcycles = mcsRes.data ?? []
    const spareParts  = spsRes.data  ?? []
    const accessories = accsRes.data ?? []
    const hasItems = motorcycles.length + spareParts.length + accessories.length > 0

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{dealer.name}</h1>
                        <p className="text-xs text-gray-400 mt-0.5">Online Shop</p>
                    </div>
                    {dealer.website && (
                        <a href={`https://${dealer.website}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-orange-500 hover:underline font-medium">
                            {dealer.website} ↗
                        </a>
                    )}
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
                {!hasItems && (
                    <div className="text-center py-24 text-gray-400">
                        <p className="text-5xl mb-4">🏪</p>
                        <p className="text-lg font-medium">No products listed yet</p>
                        <p className="text-sm mt-1">Check back soon!</p>
                    </div>
                )}

                {motorcycles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>🏍️</span> Motorcycles
                            <span className="text-sm font-normal text-gray-400 ml-1">({motorcycles.length})</span>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {motorcycles.map((m: any) => (
                                <ProductCard
                                    key={m.id}
                                    name={m.name}
                                    brand={m.brand}
                                    price={m.selling_price}
                                    images={m.images ?? []}
                                    subtitle={[m.year, m.engine_cc ? `${m.engine_cc}cc` : null, m.color].filter(Boolean).join(' · ')}
                                    description={m.description}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {spareParts.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>🔧</span> Spare Parts
                            <span className="text-sm font-normal text-gray-400 ml-1">({spareParts.length})</span>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {spareParts.map((s: any) => (
                                <ProductCard
                                    key={s.id}
                                    name={s.name}
                                    brand={s.brand}
                                    price={s.selling_price}
                                    images={s.images ?? []}
                                    subtitle={s.category}
                                    description={s.description}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {accessories.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>🪖</span> Accessories
                            <span className="text-sm font-normal text-gray-400 ml-1">({accessories.length})</span>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {accessories.map((a: any) => (
                                <ProductCard
                                    key={a.id}
                                    name={a.name}
                                    brand={a.brand}
                                    price={a.selling_price}
                                    images={a.images ?? []}
                                    subtitle={[a.category, a.size, a.color].filter(Boolean).join(' · ')}
                                    description={a.description}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </main>

            <footer className="border-t border-gray-200 mt-16 py-6 text-center text-xs text-gray-400">
                Powered by AVA MC Dealer System
            </footer>
        </div>
    )
}

function ProductCard({ name, brand, price, images, subtitle, description }: {
    name: string
    brand: string
    price: number
    images: string[]
    subtitle?: string
    description?: string
}) {
    const priceStr = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(price)
    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-square bg-gray-100 overflow-hidden">
                {images.length > 0
                    ? <img src={images[0]} alt={name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">📷</div>
                }
            </div>
            <div className="p-3">
                <p className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">{brand}</p>
                <p className="font-semibold text-gray-900 text-sm leading-snug mt-0.5 line-clamp-2">{name}</p>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
                {description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{description}</p>}
                <p className="text-base font-bold text-gray-900 mt-2">{priceStr}</p>
            </div>
        </div>
    )
}
