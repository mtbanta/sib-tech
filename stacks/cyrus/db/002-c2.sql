-- Stack C (cyrus) schema, version 2 (build C2). Written as a file first; applied by the builder with
-- `node src/tools/apply-schema.ts`. Safe to run twice. Nothing here deletes data or changes an existing column.
--
-- orders.accept_ms        how long Alpaca took to accept an order, from the moment the gate began to decide
--                         until Alpaca's answer came back (milliseconds). Reported in the daily summary.
-- orders.closed_at        set when the position an entry opened has been closed or is no longer held, so the
--                         order sync stops watching it (a day can hold thousands of entries).
-- orders.take_profit_price  the take-profit price of a bracket entry, if it had one.
-- trading_days.carried    which limits were suggested from an earlier approved day (limit name to date).
-- (The trades-a-minute limit lives in the existing limits and suggested JSON columns; no new column needed.)

alter table orders add column if not exists accept_ms integer;
alter table orders add column if not exists closed_at timestamptz;
alter table orders add column if not exists take_profit_price numeric;
alter table trading_days add column if not exists carried jsonb not null default '{}'::jsonb;

-- A symbol can now be entered more than once a day, so the date and symbol no longer identify an entry; the
-- client order id (which ends in a number) still does, and is still the primary key.
create index if not exists orders_symbol_idx on orders (trade_date, symbol);
