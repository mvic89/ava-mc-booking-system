-- ─────────────────────────────────────────────────────────────────────────────
-- migration_cancellations.sql
-- Deal cancellations and credit/refund records.
-- Run once per environment.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cancellations (
  id               uuid primary key default gen_random_uuid(),
  lead_id          text             not null,
  dealership_id    text             not null,
  agreement_number text,
  customer_name    text,
  vehicle          text,

  -- Why the deal was cancelled
  reason           text             not null,  -- changed_mind | financial | found_elsewhere | financing_denied | other
  reason_detail    text,

  -- Credit / refund
  refund_amount    numeric(12,2)    not null default 0,
  refund_currency  text             not null default 'SEK',
  refund_bank      text,            -- e.g. "Handelsbanken"
  refund_clearing  text,            -- 4-digit clearing number
  refund_account   text,            -- account number
  refund_reference text,            -- e.g. "ÅTERBET-2024-001"
  refund_status    text             not null default 'pending',  -- pending | sent | confirmed

  -- Inventory
  return_to_stock  boolean          not null default true,

  -- Meta
  notes            text,
  cancelled_by     text,            -- salesperson name/email
  status           text             not null default 'open',  -- open | closed
  created_at       timestamptz      not null default now(),
  updated_at       timestamptz      not null default now()
);

create index if not exists cancellations_lead_id_idx        on cancellations (lead_id);
create index if not exists cancellations_dealership_id_idx  on cancellations (dealership_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- blocket_listings — track which inventory items are published on Blocket
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists blocket_listings (
  id                uuid primary key default gen_random_uuid(),
  dealership_id     text             not null,
  inventory_item_id text             not null,   -- motorcycles.id / spare_parts.id
  item_type         text             not null default 'motorcycle',  -- motorcycle | spare_part | accessory
  blocket_ad_id     text,            -- ID returned by Blocket API
  status            text             not null default 'pending',  -- pending | active | removed | error
  error_message     text,
  published_at      timestamptz,
  removed_at        timestamptz,
  created_at        timestamptz      not null default now(),
  updated_at        timestamptz      not null default now()
);

create index if not exists blocket_listings_dealership_idx on blocket_listings (dealership_id);
create index if not exists blocket_listings_item_idx       on blocket_listings (inventory_item_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- payment_notifications — dealer alert when payment is confirmed
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists payment_notifications (
  id                uuid primary key default gen_random_uuid(),
  dealership_id     text             not null,
  lead_id           text,
  invoice_id        text,
  notification_type text             not null,  -- bgmax_matched | manual_confirm | webhook | fortnox
  amount            numeric(12,2),
  currency          text             not null default 'SEK',
  reference         text,
  customer_name     text,
  vehicle           text,
  read              boolean          not null default false,
  email_sent        boolean          not null default false,
  sms_sent          boolean          not null default false,
  created_at        timestamptz      not null default now()
);

create index if not exists payment_notifications_dealership_idx on payment_notifications (dealership_id);
create index if not exists payment_notifications_unread_idx    on payment_notifications (dealership_id, read);

-- ─────────────────────────────────────────────────────────────────────────────
-- Add standard_discount_pct to dealership_settings (offer defaults)
-- ─────────────────────────────────────────────────────────────────────────────

alter table dealership_settings
  add column if not exists standard_discount_pct numeric(5,2) not null default 5.00,
  add column if not exists website_webhook_url    text,
  add column if not exists website_api_key        text;
