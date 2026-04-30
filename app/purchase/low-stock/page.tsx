import { redirect } from 'next/navigation'

export default function LowStockRedirect() {
    redirect('/inventory/low-stock')
}
