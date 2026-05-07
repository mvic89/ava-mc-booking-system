// ─── Daily cron: send service reminder emails ─────────────────────────────────
// GET /api/cron/service-reminders?secret=…
// Runs every day at 08:00 via vercel.json cron.
// Finds all active reminders due within 7 days, sends an email, advances next_reminder_at.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendServiceEmail } from '@/lib/serviceEmail';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return getSupabaseAdmin() as any; }

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function reminderEmailMessage(
  customerName: string,
  vehicleName: string,
  plate: string,
  intervalMonths: number,
  dealershipName: string,
  bookingUrl: string,
): { subject: string; message: string } {
  const vehicle = vehicleName || plate || 'ditt fordon';
  const intervalLabel = intervalMonths === 12 ? 'ett år' : `${intervalMonths} månader`;
  return {
    subject: `Dags för service – ${vehicle}`,
    message: `Hej ${customerName}!\n\nDet är nu ungefär ${intervalLabel} sedan vi senast servicade ${vehicle}. Det är dags att boka din nästa service!\n\nBoka enkelt online:\n${bookingUrl}\n\nElller ring oss direkt, så hjälper vi dig hitta ett passande tillfälle.\n\nMed vänliga hälsningar\n${dealershipName}`,
  };
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today    = new Date();
  const in7Days  = new Date(today);
  in7Days.setDate(today.getDate() + 7);
  const todayStr    = today.toISOString().slice(0, 10);
  const in7DaysStr  = in7Days.toISOString().slice(0, 10);

  // Fetch all active reminders due within 7 days
  const { data: reminders, error } = await sb()
    .from('service_reminders')
    .select('*')
    .eq('status', 'active')
    .lte('next_reminder_at', in7DaysStr)
    .or(`last_sent_at.is.null,last_sent_at.lt.${new Date(Date.now() - 25 * 86400_000).toISOString()}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reminders?.length) return NextResponse.json({ sent: 0, message: 'No reminders due' });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let sent = 0;
  const results: Array<{ id: number; customer: string; status: string }> = [];

  for (const reminder of reminders) {
    // Fetch dealership name
    const { data: dealer } = await sb()
      .from('dealerships')
      .select('name')
      .eq('id', reminder.dealership_id)
      .maybeSingle();
    const dealerName = dealer?.name ?? 'Verkstaden';

    if (!reminder.customer_email) {
      results.push({ id: reminder.id, customer: reminder.customer_name, status: 'skipped — no email' });
      continue;
    }

    const bookingUrl = `${appUrl}/service/bookings/new`;
    const { subject, message } = reminderEmailMessage(
      reminder.customer_name,
      reminder.vehicle_name,
      reminder.plate,
      reminder.interval_months,
      dealerName,
      bookingUrl,
    );

    try {
      await sendServiceEmail({
        dealershipId:   reminder.dealership_id,
        customerId:     reminder.customer_id ?? null,
        recipientName:  reminder.customer_name,
        recipientEmail: reminder.customer_email,
        subject,
        message,
      });

      // Advance next_reminder_at by interval_months from today
      const nextReminder = addMonths(todayStr, reminder.interval_months);
      await sb()
        .from('service_reminders')
        .update({
          last_sent_at:    new Date().toISOString(),
          next_reminder_at: nextReminder,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', reminder.id);

      sent++;
      results.push({ id: reminder.id, customer: reminder.customer_name, status: 'sent' });
    } catch (err) {
      results.push({ id: reminder.id, customer: reminder.customer_name, status: `error: ${String(err)}` });
    }
  }

  return NextResponse.json({ sent, total: reminders.length, results });
}
