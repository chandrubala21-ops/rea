-- Senthil Andavar Hardwares: shop database.
-- Plain Postgres 15+, ready for Supabase (paste into the Supabase SQL editor, then run seed.sql).
-- Catalogue tables are readable by anyone; orders can only be placed through place_order().

create extension if not exists pg_trgm;

-- Menu: Department > Group > Product type (the mega menu and category pages).
create table if not exists departments (
  id serial primary key,
  slug text not null unique,
  name text not null,
  name_ta text,                       -- Tamil name
  sort int not null default 0
);

create table if not exists product_groups (
  id serial primary key,
  department_id int not null references departments(id) on delete cascade,
  slug text not null unique,
  name text not null,
  name_ta text,
  sort int not null default 0
);

create table if not exists product_types (
  id serial primary key,
  group_id int not null references product_groups(id) on delete cascade,
  slug text not null unique,
  name text not null,
  name_ta text,
  filters text[] not null default '{}',   -- filter panel for this page, in display order (size first)
  sort int not null default 0
);

create table if not exists products (
  id bigserial primary key,
  sku text not null unique,               -- stable code made from the shop's item name
  item_name text not null,                -- name as in the billing software (Busy)
  title text not null,                    -- tidied name shown on the website
  type_id int not null references product_types(id),
  brand text not null default 'Unbranded',
  material text,                          -- PVC, UPVC, CPVC, GI, Brass ... (quick order uses this)
  colour text,
  sizes text[] not null default '{}',     -- every size spelling the item answers to: '3/4in', '20mm'
  attrs jsonb not null default '{}',      -- filter values, e.g. {"Size (inch)": "3/4\"", "Fitting Shape": "Elbow"}
  price_inr numeric(12,2),                -- selling price incl. GST; null = ask for price
  mrp_inr numeric(12,2),
  unit text not null default 'pcs',
  stock_qty int,                          -- null = not tracked yet
  is_active boolean not null default true,
  needs_review boolean not null default false,
  image_url text,
  description text,
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(item_name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(material, ''))
  ) stored
);

create index if not exists products_type_idx on products(type_id);
create index if not exists products_sizes_idx on products using gin(sizes);
create index if not exists products_attrs_idx on products using gin(attrs);
create index if not exists products_search_idx on products using gin(search);
create index if not exists products_title_trgm on products using gin(title gin_trgm_ops);

-- Orders and reservations ("reserve and collect" / delivery / bulk quote).
create table if not exists orders (
  id bigserial primary key,
  order_no text not null unique default ('SA' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0')),
  created_at timestamptz not null default now(),
  customer_name text not null,
  phone text not null,
  fulfilment text not null default 'collect' check (fulfilment in ('collect', 'delivery', 'quote')),
  address text,
  note text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'ready', 'completed', 'cancelled')),
  total_inr numeric(12,2)
);

create table if not exists order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id bigint references products(id),
  sku text not null,
  title text not null,
  qty numeric(12,2) not null check (qty > 0),
  unit_price_inr numeric(12,2)
);

-- Shop size notation -> size tokens stored in products.sizes.
-- '3x4' and '3/4' -> 3/4in, '11/2' -> 1-1/2in, '1.5"' -> 1-1/2in, '20mm' / '20 mm' -> 20mm,
-- '4x2' (bigger first) -> 4in and 2in (a reducer).
create or replace function size_tokens(q text) returns text[]
language plpgsql immutable as $$
declare
  m text[];
  out text[] := '{}';
  a int; b int;
begin
  q := regexp_replace(lower(q), '(\d+\s*[x*]\s*)?\d+(\.\d+)?\s*sq\.?\s*mm\y', ' ', 'g');   -- cable sq mm is not a size
  for m in select regexp_matches(q, '(\d+(?:\.\d+)?)\s*mm\y', 'g') loop
    out := out || ((m[1]::float8)::text || 'mm');
  end loop;
  q := regexp_replace(lower(q), '\d+(?:\.\d+)?\s*mm\y', ' ', 'g');
  for m in select regexp_matches(q, '(?:^|[^\d/.])(\d{1,2})\s+(\d)\s*/\s*([248])(?![\d/])', 'g') loop
    out := out || (m[1] || '-' || m[2] || '/' || m[3] || 'in');                 -- 1 1/2 -> 1-1/2
  end loop;
  q := regexp_replace(q, '(^|[^\d/.])\d{1,2}\s+\d\s*/\s*[248](?![\d/])', '\1 ', 'g');
for m in select regexp_matches(q, '(?:^|[^\d/.])(\d{1,2})\s*[x*/]\s*(\d{1,2})(?![\d/])', 'g') loop
    a := m[1]::int; b := m[2]::int;
    if length(m[1]) = 2 and (a % 10) > 0 and (a % 10) < b and b in (2, 4, 8) then
      out := out || ((a / 10)::text || '-' || (a % 10)::text || '/' || b || 'in');   -- 11/2 -> 1-1/2
    elsif a < b and b in (2, 4, 8, 16) then
      out := out || (a || '/' || b || 'in');                                    -- 3x4 -> 3/4
    else
      out := out || (a || 'in') || (b || 'in');                                 -- 4x2 -> 4in, 2in
    end if;
  end loop;
  for m in select regexp_matches(q, '(?:^|\s)(\d{1,2})\s*(?:"|''''|inch|in)(?=\s|$)', 'g') loop
    out := out || (m[1] || 'in');
  end loop;
  return out;
end $$;

-- Search used by the website when it runs on Supabase: words + sizes, optional product type.
create or replace function search_products(q text, type_slug text default null, max_rows int default 500)
returns setof products language sql stable as $$
  with s as (
    select size_tokens(q) as sz,
           nullif(trim(regexp_replace(regexp_replace(lower(q), '\d+(?:\.\d+)?\s*mm\y|\d{1,2}\s*[x*/]\s*\d{1,2}|\d{1,2}\s*("|''''|inch\y)', ' ', 'g'), '\s+', ' ', 'g')), '') as words
  )
  select p.* from products p, s
  left join product_types t on t.slug = type_slug
  where p.is_active
    and (type_slug is null or p.type_id = t.id)
    and (cardinality(s.sz) = 0 or p.sizes && s.sz)
    and (s.words is null or p.search @@ to_tsquery('simple', array_to_string(array(select w || ':*' from unnest(string_to_array(s.words, ' ')) w where w <> ''), ' & ')))
  order by p.title
  limit max_rows
$$;

-- Place an order from the website. Anonymous visitors can call this but cannot read other orders.
create or replace function place_order(customer_name text, phone text, fulfilment text, items jsonb,
                                       address text default null, note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  oid bigint; ono text; total numeric := 0;
  it jsonb; pr products;
begin
  if coalesce(trim(customer_name), '') = '' or coalesce(trim(phone), '') = '' then
    raise exception 'name and phone are required';
  end if;
  if jsonb_array_length(items) = 0 or jsonb_array_length(items) > 300 then
    raise exception 'order must have 1 to 300 lines';
  end if;
  insert into orders (customer_name, phone, fulfilment, address, note)
  values (customer_name, phone, fulfilment, address, note) returning id, order_no into oid, ono;
  for it in select * from jsonb_array_elements(items) loop
    select * into pr from products where sku = it->>'sku' and is_active;
    if not found then raise exception 'unknown item %', it->>'sku'; end if;
    insert into order_items (order_id, product_id, sku, title, qty, unit_price_inr)
    values (oid, pr.id, pr.sku, pr.title, (it->>'qty')::numeric, pr.price_inr);
    total := total + coalesce(pr.price_inr, 0) * (it->>'qty')::numeric;
  end loop;
  update orders set total_inr = total where id = oid;
  return ono;
end $$;

-- Row level security (Supabase): public can read the catalogue, nothing else.
alter table departments enable row level security;
alter table product_groups enable row level security;
alter table product_types enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'public read departments') then
    create policy "public read departments" on departments for select using (true);
    create policy "public read groups" on product_groups for select using (true);
    create policy "public read types" on product_types for select using (true);
    create policy "public read products" on products for select using (is_active);
  end if;
end $$;
