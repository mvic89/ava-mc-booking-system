// ── POST /api/invite ───────────────────────────────────────────────────────────
// Sends a staff invitation email via Resend.
// Accepts an array of invitees so the admin can invite multiple users at once.
//
// Body:
//   {
//     invitees: [
//       { email: string; name: string; role: 'admin'|'sales'|'service'; inviteUrl: string }
//     ];
//     dealershipName: string;
//     inviterName:    string;
//   }
//
// Returns:
//   { sent: number; results: Array<{ email: string; id?: string; error?: string }> }

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import React from 'react';
import { InviteEmail } from '@/components/emails/InviteEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

// Verified domain: contact.bikeme.now — make sure this domain is added and
// verified in your Resend dashboard (resend.com/domains) before going live.
const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? 'BikeMeNow <noreply@contact.bikeme.now>';

interface Invitee {
  email:     string;
  name:      string;
  role:      'admin' | 'sales' | 'service';
  inviteUrl: string;
}

interface InviteBody {
  invitees:       Invitee[];
  dealershipId:   string;
  dealershipName: string;
  inviterName:    string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InviteBody;
    const { invitees, dealershipId, dealershipName, inviterName } = body;

    if (!invitees?.length || !dealershipId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const REPLY_DOMAIN = process.env.POSTMARK_INBOUND_DOMAIN ?? 'inbound.bikeme.now';
    const replyTo = `reply+${dealershipId}@${REPLY_DOMAIN}`;

    // Send one email per invitee (individual personalised messages)
    const results = await Promise.all(
      invitees.map(async (invitee) => {
        const { data, error } = await resend.emails.send({
          from:    FROM_ADDRESS,
          to:      [invitee.email],
          replyTo: `"${dealershipName}" <${replyTo}>`,
          subject: `Du har bjudits in till ${dealershipName}`,
          react:   React.createElement(InviteEmail, {
            inviteeName:    invitee.name,
            dealershipName,
            role:           invitee.role,
            inviteUrl:      invitee.inviteUrl,
            inviterName,
          }),
        });

        if (error) {
          console.error(`[invite] failed for ${invitee.email}:`, error);
          return { email: invitee.email, error: error.message };
        }

        return { email: invitee.email, id: data?.id };
      }),
    );

    const sent   = results.filter(r => !r.error).length;
    const failed = results.filter(r =>  r.error).length;

    return NextResponse.json({ sent, failed, results });
  } catch (err) {
    console.error('[invite] unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
