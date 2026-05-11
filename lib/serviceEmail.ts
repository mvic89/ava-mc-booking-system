// Sends automated service-related emails via /api/communications/send
// Called server-side from service booking/order PATCH routes.

interface ServiceEmailPayload {
  dealershipId:   string;
  customerId?:    number | null;
  recipientName:  string;
  recipientEmail: string;
  subject:        string;
  message:        string;
}

export async function sendServiceEmail(payload: ServiceEmailPayload): Promise<void> {
  if (!payload.recipientEmail) return;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/communications/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId:   payload.dealershipId,
        channel:        'email',
        customerId:     payload.customerId ?? null,
        recipientName:  payload.recipientName,
        recipientEmail: payload.recipientEmail,
        subject:        payload.subject,
        message:        payload.message,
        sentBy:         'system',
      }),
    });
  } catch {
    // Fire-and-forget — never block the main response
  }
}

// ── Pre-built message builders ─────────────────────────────────────────────────

export function bookingConfirmedMessage(customerName: string, vehicleName: string, scheduledAt: string, dealershipName: string): { subject: string; message: string } {
  const dateStr = new Date(scheduledAt).toLocaleString('sv-SE', { dateStyle: 'full', timeStyle: 'short' });
  return {
    subject: `Din bokning är bekräftad – ${vehicleName}`,
    message: `Hej ${customerName}!\n\nDin serviceBokning hos ${dealershipName} är bekräftad.\n\nFordon: ${vehicleName}\nDatum: ${dateStr}\n\nVi ser fram emot ditt besök. Om du behöver ändra din bokning, hör av dig till oss.\n\nMed vänliga hälsningar\n${dealershipName}`,
  };
}

export function vehicleReadyMessage(customerName: string, vehicleName: string, plate: string, dealershipName: string): { subject: string; message: string } {
  return {
    subject: `Din motorcykel är klar för avhämtning – ${plate || vehicleName}`,
    message: `Hej ${customerName}!\n\nVi vill meddela att ditt fordon nu är klart för avhämtning.\n\nFordon: ${vehicleName}${plate ? ` (${plate})` : ''}\n\nDu kan hämta fordonet under vår öppettid. Välkommen!\n\nMed vänliga hälsningar\n${dealershipName}`,
  };
}

export function workOrderCreatedMessage(customerName: string, vehicleName: string, description: string, dealershipName: string): { subject: string; message: string } {
  return {
    subject: `Serviceärendet är registrerat – ${vehicleName}`,
    message: `Hej ${customerName}!\n\nVi har registrerat ditt serviceärende.\n\nFordon: ${vehicleName}\nÄrende: ${description}\n\nVi återkommer när arbetet är slutfört.\n\nMed vänliga hälsningar\n${dealershipName}`,
  };
}
