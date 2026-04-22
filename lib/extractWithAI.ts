import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Estimate PDF page count from base64 size.
 * A typical 1-page PDF is ~50-150KB. We use 100KB per page as a rough threshold.
 * If estimated pages > 1, use Sonnet. Otherwise Haiku is sufficient.
 */
function selectModel(pdfBase64: string): { model: string; max_tokens: number } {
    const sizeBytes = (pdfBase64.length * 3) / 4  // base64 → bytes
    const estimatedPages = Math.ceil(sizeBytes / 100_000)
    if (estimatedPages > 1) {
        return { model: 'claude-sonnet-4-6', max_tokens: 4096 }
    }
    // Haiku with enough tokens to never truncate a single-page invoice JSON
    return { model: 'claude-haiku-4-5-20251001', max_tokens: 2048 }
}

// ── Invoice extraction ────────────────────────────────────────────────────────

export interface AIInvoiceResult {
    supplier_name:           string | null   // company name of the supplier
    supplier_invoice_number: string | null
    po_reference:            string | null   // primary PO reference (first one found)
    po_references:           string[]        // ALL PO references (for consolidated invoices)
    invoice_date:            string | null   // YYYY-MM-DD
    due_date:                string | null   // YYYY-MM-DD
    amount:                  number          // total incl. tax
    currency:                string          // SEK, EUR, etc.
    lineItems: {
        article_number:   string | null
        description:      string
        qty:              number
        gross_unit_price: number            // original price before discount (Bruttopris / A-pris / Pris)
        discount_pct:     number            // discount percentage (Rabatt %)
        discount_amount:  number            // discount amount in currency
        unit_price:       number            // net price after discount (Nettopris)
        line_total:       number            // final line total after discount
        vin:              string | null
        po_reference:     string | null
    }[]
}

export async function extractInvoiceWithAI(pdfBase64: string, forceSonnet = false): Promise<AIInvoiceResult> {
    const selected = selectModel(pdfBase64)
    const model      = forceSonnet ? 'claude-sonnet-4-6' : selected.model
    const max_tokens = forceSonnet ? 4096 : selected.max_tokens
    console.log(`[extractInvoiceWithAI] using ${model} (estimated size: ${Math.round((pdfBase64.length * 3) / 4 / 1024)}KB)`)

    const message = await client.messages.create({
        model,
        max_tokens,
        messages: [{
            role:    'user',
            content: [
                {
                    type:   'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
                },
                {
                    type: 'text',
                    text: `You are extracting data from a supplier invoice PDF. Return ONLY a valid JSON object — no explanation, no markdown code blocks.

IMPORTANT: Extract VALUES not LABELS. For example:
- "Fakturanr" is a label — extract the NUMBER next to it (e.g. "160719498")
- "Er referens" is a label — extract the VALUE next to it (e.g. "79446")
- "Leveransmetod" is a label for delivery method — do NOT use this as PO reference
- "Ert ordernr" is a label — extract the VALUE next to it

Return this exact JSON structure:
{
  "supplier_name": "the supplier/vendor company name (e.g. KGK Motor AB, Polaris Scandinavia AB) — the company SENDING the invoice, not AVA MC",
  "supplier_invoice_number": "the actual invoice number value (e.g. 160719498), NOT the label Fakturanr",
  "po_reference": "the FIRST Er referens / Ert ordernr VALUE — this is the BUYER's PO number. Do NOT use Försäljningsorder (that is the supplier's own sales order number, not the PO reference). If Er referens is empty or not present return null.",
  "po_references": ["ALL Er referens / Ert ordernr VALUES as array — for SAMLINGSFAKTURA with multiple orders include all of them. Never include Försäljningsorder values here."],
  "invoice_date": "Fakturadatum value in YYYY-MM-DD (e.g. 25-10-31 → 2025-10-31)",
  "due_date": "Oss tillhanda OR Förfallodatum value in YYYY-MM-DD",
  "amount": the ATT BETALA / total amount INCLUDING VAT as a plain number (e.g. 32595.00),
  "currency": "SEK or EUR etc",
  "lineItems": [
    {
      "article_number": "the Artikelnummer value (e.g. 11366MLAA50)",
      "description": "the Benämning / product description (e.g. COVER,LINEAR SOLE)",
      "qty": the Lev. kvant / Antal quantity as number,
      "gross_unit_price": the original price BEFORE discount — Bruttopris / A-pris / Pris column as number (0 if not shown),
      "discount_pct": the discount percentage — Rabatt % column as number (0 if no discount),
      "discount_amount": the discount amount in currency — calculate as (gross_unit_price - unit_price) * qty if not shown explicitly (0 if no discount),
      "unit_price": the net price AFTER discount — Nettopris column as number,
      "line_total": the Radtotal / Radnetto / Belopp final line total as number,
      "vin": "17-char VIN/chassis/ramnummer if this is a vehicle line, otherwise null",
      "po_reference": "which Er referens value this line belongs to (for SAMLINGSFAKTURA), or null"
    }
  ]
}

Number format: Swedish numbers use period as thousand separator and comma as decimal (9.874,80 → 9874.80)
Dates: two-digit year format (25-10-31 → 2025-10-31)
For SAMLINGSFAKTURA: extract ALL line items from ALL pages and ALL order sections
Only include actual product lines in lineItems — not freight (Fraktavgift), subtotals or tax rows`,
                },
            ],
        }],
    })

    const raw  = (message.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '')
    try {
        return JSON.parse(json) as AIInvoiceResult
    } catch {
        if (!forceSonnet) {
            // Response was truncated by Haiku — retry with Sonnet
            console.warn('[extractInvoiceWithAI] JSON truncated, retrying with Sonnet')
            return extractInvoiceWithAI(pdfBase64, true)
        }
        throw new Error('JSON parse failed')
    }
}

// ── Credit note extraction ────────────────────────────────────────────────────

export interface AICreditNoteResult {
    supplier_name:           string | null
    supplier_credit_number:  string | null   // the credit note's own reference number
    original_invoice_number: string | null   // the invoice this credit refers to
    credit_date:             string | null   // YYYY-MM-DD
    amount:                  number          // positive number — the credit value
    currency:                string
    reason:                  string | null   // reason for the credit
    lineItems: {
        article_number: string | null
        description:    string
        qty:            number
        unit_price:     number
        line_total:     number
    }[]
}

export async function extractCreditNoteWithAI(pdfBase64: string): Promise<AICreditNoteResult> {
    const { model, max_tokens } = selectModel(pdfBase64)
    console.log(`[extractCreditNoteWithAI] using ${model}`)

    const message = await client.messages.create({
        model,
        max_tokens,
        messages: [{
            role:    'user',
            content: [
                {
                    type:   'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
                },
                {
                    type: 'text',
                    text: `You are extracting data from a supplier credit note (kreditfaktura / kreditnota / credit memo). Return ONLY valid JSON — no explanation, no markdown.

IMPORTANT: A credit note is the OPPOSITE of an invoice — it reduces what the buyer owes. The amount should be returned as a POSITIVE number (the system will treat it as negative).

Return this exact JSON structure:
{
  "supplier_name": "the supplier company name issuing this credit note",
  "supplier_credit_number": "the credit note's own reference number (Kreditfakturanr / Credit Note #)",
  "original_invoice_number": "the original invoice number this credit refers to — look for 'Avser faktura', 'Krediterar faktura nr', 'Ref. faktura', 'Original invoice' etc. Return null if not found.",
  "credit_date": "credit note date in YYYY-MM-DD",
  "amount": the total credit amount as a POSITIVE number (e.g. 5250.00),
  "currency": "SEK or EUR etc",
  "reason": "reason for the credit — look for Anledning, Orsak, Reason, or any explanatory text",
  "lineItems": [
    {
      "article_number": "article/product code or null",
      "description": "product description",
      "qty": quantity as number,
      "unit_price": unit price as number,
      "line_total": line total as positive number
    }
  ]
}

Number format: Swedish numbers use period as thousand separator and comma as decimal (9.874,80 → 9874.80)
Dates: two-digit year format (25-10-31 → 2025-10-31)`,
                },
            ],
        }],
    })

    const raw  = (message.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(json) as AICreditNoteResult
}

// ── Delivery note extraction ───────────────────────────────────────────────────

export interface AIDeliveryNoteResult {
    vendor:               string | null
    delivery_note_number: string | null
    received_date:        string | null   // YYYY-MM-DD
    po_reference:         string | null
    notes:                string | null
    items: {
        article_number: string | null
        name:           string
        ordered_qty:    number | null
        received_qty:   number
        unit_cost:      number | null
    }[]
}

export async function extractDeliveryNoteWithAI(pdfBase64: string): Promise<AIDeliveryNoteResult> {
    const { model, max_tokens: baseTokens } = selectModel(pdfBase64)
    const max_tokens = Math.max(baseTokens, 2048)  // delivery notes always need at least 2048
    console.log(`[extractDeliveryNoteWithAI] using ${model} (estimated size: ${Math.round((pdfBase64.length * 3) / 4 / 1024)}KB)`)

    const message = await client.messages.create({
        model,
        max_tokens,
        messages: [{
            role:    'user',
            content: [
                {
                    type:   'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
                },
                {
                    type: 'text',
                    text: `Extract the following fields from this delivery note / följesedel / packing slip and return ONLY valid JSON — no explanation, no markdown.

{
  "vendor": "supplier/vendor company name or null",
  "delivery_note_number": "delivery note / följesedelnr / paketsedelnummer as string or null",
  "received_date": "delivery or shipment date in YYYY-MM-DD format or null",
  "po_reference": "purchase order reference / ordernummer / PO number or null",
  "notes": "any remarks or special notes or null",
  "items": [
    {
      "article_number": "article/product code or null",
      "name": "product name or description",
      "ordered_qty": quantity ordered as number or null,
      "received_qty": quantity delivered/received as number,
      "unit_cost": unit price as number or null
    }
  ]
}

Rules:
- dates must be YYYY-MM-DD format
- numbers must be plain numbers
- received_qty is the quantity actually delivered in this shipment
- ordered_qty is the total quantity on the order (may not be present)
- only include actual product lines in items, not header or footer rows
- if a field is not found return null`,
                },
            ],
        }],
    })

    const raw  = (message.content[0] as { type: string; text: string }).text.trim()
    const json = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(json) as AIDeliveryNoteResult
}
