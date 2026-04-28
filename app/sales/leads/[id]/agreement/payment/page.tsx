'use client';

// This route now redirects to the unified payment page at /sales/leads/[id]/payment
// which loads all data from the offers table for consistent, accurate amounts.

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function AgreementPaymentRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  useEffect(() => {
    if (id) router.replace(`/sales/leads/${id}/payment`);
  }, [id, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
