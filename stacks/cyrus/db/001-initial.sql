-- Stack C (cyrus) schema, version 1. Written as a file first, read by Michael, then applied by the builder
-- with `node src/tools/apply-schema.ts`. Safe to run twice (every statement is "if not exists" or repeatable).
-- Nothing here deletes data.
--
-- The worker connects straight to Postgres with the project's database address, not through Supabase's Data
-- API. Row level security is switched on for every table with no policy, and the Data API roles get nothing,
-- so the Data API cannot read or write any of these tables even though it is switched on for the project.

create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

-- Small switches that must survive a restart: the stop flag, the Discord command cursor.
create table if not exists control (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row per calendar day the worker has looked at, in New York dates (the market's date).
create table if not exists trading_days (
  trade_date date primary key,
  is_trading_day boolean not null,
  open_at timestamptz,
  close_at timestamptz,
  -- pending: waiting for Michael. approved: all four limits decided before the open. lapsed: the open came
  -- with limits undecided, so no trading today. not_trading_day: weekend or holiday.
  status text not null check (status in ('pending', 'approved', 'lapsed', 'not_trading_day')),
  day_start_equity numeric,
  suggested jsonb not null,
  limits jsonb not null,
  decided jsonb not null default '{}'::jsonb,
  live_list jsonb,
  -- when each step of the day finished, so a restart does not repeat it: morning, screen, closeout, summary
  phases jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every entry the worker decided to send. The id is the client_order_id sent to Alpaca, built from the date
-- and the symbol, so the same decision after a restart is the same id and cannot become a second order.
create table if not exists orders (
  client_order_id text primary key,
  trade_date date not null references trading_days (trade_date),
  symbol text not null,
  qty integer not null check (qty >= 1),
  reference_price numeric not null,
  stop_price numeric not null,
  -- intent: written before sending. submitted: Alpaca has it. filled / canceled / rejected: final states.
  status text not null check (status in ('intent', 'submitted', 'filled', 'canceled', 'rejected', 'failed')),
  alpaca_order_id text,
  filled_qty numeric,
  filled_avg_price numeric,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_trade_date_idx on orders (trade_date);

-- Every entry the fixed checks refused, and why.
create table if not exists refusals (
  id bigserial primary key,
  trade_date date not null,
  symbol text not null,
  reason text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists refusals_trade_date_idx on refusals (trade_date);

-- The run log: commands, limit decisions, phases, errors. No secrets are ever written here.
create table if not exists events (
  id bigserial primary key,
  at timestamptz not null default now(),
  level text not null,
  event text not null,
  data jsonb
);
create index if not exists events_at_idx on events (at);

alter table schema_migrations enable row level security;
alter table control enable row level security;
alter table trading_days enable row level security;
alter table orders enable row level security;
alter table refusals enable row level security;
alter table events enable row level security;

revoke all on schema_migrations, control, trading_days, orders, refusals, events from anon, authenticated;
