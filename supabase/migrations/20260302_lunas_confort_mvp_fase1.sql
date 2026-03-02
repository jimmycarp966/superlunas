-- Lunas Confort ERP - MVP Fase 1
-- Fecha: 2026-03-02

begin;

create extension if not exists pgcrypto;

create table if not exists public.sucursales (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    nombre text not null,
    es_casa_central boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.depositos (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid not null references public.sucursales(id) on delete cascade,
    codigo text not null,
    nombre text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (sucursal_id, codigo)
);

create table if not exists public.zonas_cobranza (
    id uuid primary key default gen_random_uuid(),
    codigo text not null unique,
    nombre text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.usuarios (
    id uuid primary key default gen_random_uuid(),
    username text not null unique,
    nombre text not null,
    password text not null,
    role text not null check (
        role in (
            'admin', 'gerente', 'auditor', 'encargado_cobranza',
            'vendedor', 'cobrador', 'repartidor', 'cajero', 'contador'
        )
    ),
    sucursal_id uuid references public.sucursales(id),
    zona text,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.auditoria_acciones (
    id uuid primary key default gen_random_uuid(),
    user_id uuid,
    username text,
    role text,
    sucursal_id text,
    action text not null,
    entity text not null,
    entity_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.products
    add column if not exists color text,
    add column if not exists tamano text,
    add column if not exists modelo text,
    add column if not exists garantia_meses integer,
    add column if not exists requiere_serie boolean not null default false,
    add column if not exists numero_serie text,
    add column if not exists imagen_url text,
    add column if not exists stock_minimo integer default 0;

create table if not exists public.producto_variantes (
    id uuid primary key default gen_random_uuid(),
    product_codigo text not null references public.products(codigo) on delete cascade,
    color text,
    tamano text,
    modelo text,
    precio numeric,
    stock integer,
    created_at timestamptz not null default now()
);

create table if not exists public.producto_fotos (
    id uuid primary key default gen_random_uuid(),
    product_codigo text not null references public.products(codigo) on delete cascade,
    url text not null,
    is_primary boolean not null default false,
    orden integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.stock_reservas (
    id uuid primary key default gen_random_uuid(),
    product_codigo text not null references public.products(codigo) on delete cascade,
    sucursal_id uuid references public.sucursales(id),
    origen text not null,
    cantidad integer not null,
    estado text not null default 'activa' check (estado in ('activa', 'liberada', 'confirmada', 'expirada')),
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create table if not exists public.stock_movimientos (
    id uuid primary key default gen_random_uuid(),
    product_codigo text not null references public.products(codigo) on delete cascade,
    sucursal_id uuid references public.sucursales(id),
    tipo text not null check (tipo in ('entrada', 'salida', 'ajuste', 'transferencia')),
    cantidad integer not null,
    referencia text,
    created_by text,
    created_at timestamptz not null default now()
);

create table if not exists public.transferencias_stock (
    id uuid primary key default gen_random_uuid(),
    product_codigo text not null references public.products(codigo) on delete cascade,
    sucursal_origen_id uuid references public.sucursales(id),
    sucursal_destino_id uuid references public.sucursales(id),
    cantidad integer not null,
    estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'enviada', 'recibida', 'cancelada')),
    aprobado_por text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.creditos_solicitudes (
    id uuid primary key default gen_random_uuid(),
    cliente text not null,
    dni text,
    vendedor text,
    zona text,
    total numeric not null default 0,
    estado text not null default 'pendiente_auditoria' check (
        estado in ('pendiente_auditoria', 'pendiente_encargado', 'pendiente_repartidor', 'aprobado', 'rechazado')
    ),
    informe_comercial_url text,
    observaciones text,
    sucursal_id uuid references public.sucursales(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.creditos_historial (
    id uuid primary key default gen_random_uuid(),
    credito_id uuid not null references public.creditos_solicitudes(id) on delete cascade,
    etapa text not null,
    accion text not null,
    usuario text,
    role text,
    comentario text,
    created_at timestamptz not null default now()
);

create table if not exists public.cobranzas_agenda (
    id uuid primary key default gen_random_uuid(),
    cliente text not null,
    dni text,
    cobrador_username text not null,
    zona text not null,
    fecha_vencimiento date not null,
    monto_pendiente numeric not null default 0,
    cuotas_restantes integer not null default 0,
    estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'vencido')),
    sucursal_id uuid references public.sucursales(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.cobranzas_pagos (
    id uuid primary key default gen_random_uuid(),
    agenda_id uuid references public.cobranzas_agenda(id) on delete set null,
    cliente text not null,
    dni text,
    cobrador_username text,
    zona text,
    monto numeric not null,
    monto_esperado numeric not null,
    mismatch boolean not null default false,
    fecha_imputacion date not null,
    fecha_deuda_objetivo date not null,
    medio_pago text not null,
    observaciones text,
    sucursal_id uuid references public.sucursales(id),
    created_by text,
    created_at timestamptz not null default now()
);

create table if not exists public.cobranzas_rendiciones (
    id uuid primary key default gen_random_uuid(),
    fecha date not null,
    username text not null,
    zona text,
    sucursal_id uuid references public.sucursales(id),
    monto_total numeric not null,
    destino text not null check (destino in ('cajero', 'encargado')),
    observaciones text,
    created_at timestamptz not null default now()
);

create table if not exists public.tesoreria_pagos (
    id uuid primary key default gen_random_uuid(),
    cliente text not null,
    dni text,
    monto numeric not null,
    monto_esperado numeric not null,
    fecha_imputacion date not null,
    fecha_deuda_objetivo date not null,
    medio_pago text not null,
    sucursal_id uuid references public.sucursales(id),
    registrado_por text,
    conciliado boolean not null default false,
    observaciones text,
    created_at timestamptz not null default now()
);

create table if not exists public.reparto_rutas (
    id uuid primary key default gen_random_uuid(),
    fecha_programada date not null,
    repartidor_username text not null,
    cliente text not null,
    direccion text not null,
    detalle text,
    estado text not null default 'pendiente' check (estado in ('pendiente', 'en_ruta', 'entregado', 'reprogramado')),
    sucursal_id uuid references public.sucursales(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.reparto_entregas (
    id uuid primary key default gen_random_uuid(),
    ruta_id uuid references public.reparto_rutas(id) on delete set null,
    repartidor_username text not null,
    cliente text not null,
    direccion text,
    firma_url text,
    foto_entrega_url text,
    checklist_camion jsonb not null default '{}'::jsonb,
    gps_lat numeric,
    gps_lng numeric,
    sucursal_id uuid references public.sucursales(id),
    created_at timestamptz not null default now()
);

create table if not exists public.reparto_gps_logs (
    id uuid primary key default gen_random_uuid(),
    repartidor_username text not null,
    lat numeric not null,
    lng numeric not null,
    accuracy numeric,
    sucursal_id uuid references public.sucursales(id),
    created_at timestamptz not null default now()
);

create table if not exists public.notificaciones (
    id uuid primary key default gen_random_uuid(),
    tipo text not null,
    titulo text not null,
    mensaje text not null,
    referencia_id text,
    canal text not null default 'sistema',
    leida boolean not null default false,
    created_at timestamptz not null default now()
);

create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_touch_sucursales on public.sucursales;
create trigger trg_touch_sucursales
before update on public.sucursales
for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_depositos on public.depositos;
create trigger trg_touch_depositos
before update on public.depositos
for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_usuarios on public.usuarios;
create trigger trg_touch_usuarios
before update on public.usuarios
for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_transferencias_stock on public.transferencias_stock;
create trigger trg_touch_transferencias_stock
before update on public.transferencias_stock
for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_creditos_solicitudes on public.creditos_solicitudes;
create trigger trg_touch_creditos_solicitudes
before update on public.creditos_solicitudes
for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_cobranzas_agenda on public.cobranzas_agenda;
create trigger trg_touch_cobranzas_agenda
before update on public.cobranzas_agenda
for each row execute function public.fn_touch_updated_at();

drop trigger if exists trg_touch_reparto_rutas on public.reparto_rutas;
create trigger trg_touch_reparto_rutas
before update on public.reparto_rutas
for each row execute function public.fn_touch_updated_at();

insert into public.sucursales (codigo, nombre, es_casa_central)
values
    ('concepcion', 'Concepcion (Casa Central)', true),
    ('catamarca', 'Catamarca', false)
on conflict (codigo) do update
set nombre = excluded.nombre,
    es_casa_central = excluded.es_casa_central;

insert into public.depositos (sucursal_id, codigo, nombre)
select s.id, d.codigo, d.nombre
from public.sucursales s
join (
    values
        ('concepcion', 'alto_verde', 'Deposito Central Alto Verde'),
        ('concepcion', 'republica', 'Deposito Republica')
) as d(sucursal_codigo, codigo, nombre)
    on d.sucursal_codigo = s.codigo
on conflict (sucursal_id, codigo) do update
set nombre = excluded.nombre;

insert into public.zonas_cobranza (codigo, nombre)
values
    ('famailla', 'Famailla'),
    ('lules', 'Lules'),
    ('monteros', 'Monteros'),
    ('concepcion', 'Concepcion'),
    ('trinidad', 'Trinidad'),
    ('aguilares', 'Aguilares'),
    ('taco_ralo', 'Taco Ralo'),
    ('alberdi', 'Alberdi'),
    ('los_altos', 'Los Altos'),
    ('los_valles', 'Los Valles'),
    ('mollar_tafi', 'Mollar/Tafi'),
    ('catamarca_sur', 'Catamarca Sur'),
    ('catamarca_norte', 'Catamarca Norte'),
    ('catamarca', 'Catamarca'),
    ('belen', 'Belen'),
    ('andagala', 'Andagala'),
    ('tinogasta', 'Tinogasta')
on conflict (codigo) do update
set nombre = excluded.nombre;

insert into public.usuarios (username, nombre, password, role, sucursal_id, zona, activo)
values
    (
        'admin',
        'Administrador General',
        'sha256:15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225',
        'admin',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'gerencia',
        'Gerencia',
        'sha256:15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225',
        'gerente',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'auditor01',
        'Auditor Comercial',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'auditor',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'cobranza01',
        'Encargado Cobranza',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'encargado_cobranza',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'cajero01',
        'Caja Concepcion',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'cajero',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'contador01',
        'Contador',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'contador',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'vendedor01',
        'Vendedor Concepcion',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'vendedor',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'vendedor02',
        'Vendedor Catamarca',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'vendedor',
        (select id from public.sucursales where codigo = 'catamarca'),
        null,
        true
    ),
    (
        'repartidor01',
        'Repartidor Concepcion',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'repartidor',
        (select id from public.sucursales where codigo = 'concepcion'),
        null,
        true
    ),
    (
        'repartidor02',
        'Repartidor Catamarca',
        'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        'repartidor',
        (select id from public.sucursales where codigo = 'catamarca'),
        null,
        true
    )
on conflict (username) do update
set nombre = excluded.nombre,
    password = excluded.password,
    role = excluded.role,
    sucursal_id = excluded.sucursal_id,
    zona = excluded.zona,
    activo = excluded.activo;

insert into public.usuarios (username, nombre, password, role, sucursal_id, zona, activo)
select x.username, x.nombre, x.password, x.role, x.sucursal_id, x.zona, true
from (
    values
        ('cob_famailla', 'Cobrador Famailla', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Famailla'),
        ('cob_lules', 'Cobrador Lules', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Lules'),
        ('cob_monteros', 'Cobrador Monteros', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Monteros'),
        ('cob_concepcion', 'Cobrador Concepcion', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Concepcion'),
        ('cob_trinidad', 'Cobrador Trinidad', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Trinidad'),
        ('cob_aguilares', 'Cobrador Aguilares', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Aguilares'),
        ('cob_taco_ralo', 'Cobrador Taco Ralo', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Taco Ralo'),
        ('cob_alberdi', 'Cobrador Alberdi', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Alberdi'),
        ('cob_los_altos', 'Cobrador Los Altos', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Los Altos'),
        ('cob_los_valles', 'Cobrador Los Valles', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Los Valles'),
        ('cob_mollar_tafi', 'Cobrador Mollar/Tafi', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'concepcion'), 'Mollar/Tafi'),
        ('cob_cat_sur', 'Cobrador Catamarca Sur', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'catamarca'), 'Catamarca Sur'),
        ('cob_cat_norte', 'Cobrador Catamarca Norte', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'catamarca'), 'Catamarca Norte'),
        ('cob_catamarca', 'Cobrador Catamarca', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'catamarca'), 'Catamarca'),
        ('cob_belen', 'Cobrador Belen', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'catamarca'), 'Belen'),
        ('cob_andagala', 'Cobrador Andagala', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'catamarca'), 'Andagala'),
        ('cob_tinogasta', 'Cobrador Tinogasta', 'sha256:8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'cobrador', (select id from public.sucursales where codigo = 'catamarca'), 'Tinogasta')
) as x(username, nombre, password, role, sucursal_id, zona)
on conflict (username) do update
set nombre = excluded.nombre,
    password = excluded.password,
    role = excluded.role,
    sucursal_id = excluded.sucursal_id,
    zona = excluded.zona,
    activo = true;

insert into public.reparto_rutas (fecha_programada, repartidor_username, cliente, direccion, detalle, estado, sucursal_id)
values
    (current_date, 'repartidor01', 'Cliente Ruta A', 'Concepcion Centro 123', 'Entrega heladera', 'pendiente', (select id from public.sucursales where codigo = 'concepcion')),
    (current_date + interval '1 day', 'repartidor01', 'Cliente Ruta B', 'Famailla Norte 45', 'Entrega cocina', 'pendiente', (select id from public.sucursales where codigo = 'concepcion')),
    (current_date, 'repartidor02', 'Cliente Ruta C', 'Catamarca Sur 890', 'Entrega lavarropas', 'pendiente', (select id from public.sucursales where codigo = 'catamarca'))
on conflict do nothing;

create index if not exists idx_creditos_estado on public.creditos_solicitudes(estado);
create index if not exists idx_cobranzas_agenda_fecha on public.cobranzas_agenda(fecha_vencimiento);
create index if not exists idx_cobranzas_agenda_user on public.cobranzas_agenda(cobrador_username);
create index if not exists idx_tesoreria_fecha on public.tesoreria_pagos(fecha_imputacion);
create index if not exists idx_producto_fotos_codigo on public.producto_fotos(product_codigo);
create index if not exists idx_variantes_codigo on public.producto_variantes(product_codigo);
create index if not exists idx_auditoria_fecha on public.auditoria_acciones(created_at desc);
create index if not exists idx_reparto_rutas_fecha on public.reparto_rutas(fecha_programada);
create index if not exists idx_reparto_rutas_user on public.reparto_rutas(repartidor_username);
create index if not exists idx_reparto_gps_user_fecha on public.reparto_gps_logs(repartidor_username, created_at desc);

alter table public.usuarios enable row level security;
alter table public.products enable row level security;
alter table public.producto_fotos enable row level security;
alter table public.producto_variantes enable row level security;
alter table public.creditos_solicitudes enable row level security;
alter table public.cobranzas_agenda enable row level security;
alter table public.tesoreria_pagos enable row level security;
alter table public.auditoria_acciones enable row level security;
alter table public.reparto_rutas enable row level security;
alter table public.reparto_entregas enable row level security;
alter table public.reparto_gps_logs enable row level security;

drop policy if exists service_role_all_usuarios on public.usuarios;
create policy service_role_all_usuarios on public.usuarios
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_products on public.products;
create policy service_role_all_products on public.products
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists public_read_products on public.products;
create policy public_read_products on public.products
for select
using (true);

drop policy if exists service_role_all_producto_fotos on public.producto_fotos;
create policy service_role_all_producto_fotos on public.producto_fotos
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists public_read_producto_fotos on public.producto_fotos;
create policy public_read_producto_fotos on public.producto_fotos
for select
using (true);

drop policy if exists service_role_all_producto_variantes on public.producto_variantes;
create policy service_role_all_producto_variantes on public.producto_variantes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists public_read_producto_variantes on public.producto_variantes;
create policy public_read_producto_variantes on public.producto_variantes
for select
using (true);

drop policy if exists service_role_all_creditos on public.creditos_solicitudes;
create policy service_role_all_creditos on public.creditos_solicitudes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_cobranzas_agenda on public.cobranzas_agenda;
create policy service_role_all_cobranzas_agenda on public.cobranzas_agenda
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_tesoreria on public.tesoreria_pagos;
create policy service_role_all_tesoreria on public.tesoreria_pagos
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_auditoria on public.auditoria_acciones;
create policy service_role_all_auditoria on public.auditoria_acciones
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_reparto_rutas on public.reparto_rutas;
create policy service_role_all_reparto_rutas on public.reparto_rutas
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_reparto_entregas on public.reparto_entregas;
create policy service_role_all_reparto_entregas on public.reparto_entregas
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_reparto_gps on public.reparto_gps_logs;
create policy service_role_all_reparto_gps on public.reparto_gps_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- RLS orientado a negocio para usuarios autenticados con JWT de Supabase.
drop policy if exists app_read_creditos on public.creditos_solicitudes;
create policy app_read_creditos on public.creditos_solicitudes
for select
using (
    auth.role() = 'authenticated'
    and (
        auth.jwt() ->> 'role' in ('admin', 'gerente', 'contador')
        or (auth.jwt() ->> 'role' = 'vendedor' and vendedor = auth.jwt() ->> 'nombre')
        or (auth.jwt() ->> 'role' = 'cobrador' and vendedor = auth.jwt() ->> 'nombre')
        or (auth.jwt() ->> 'role' = 'auditor' and estado = 'pendiente_auditoria')
        or (auth.jwt() ->> 'role' = 'encargado_cobranza' and estado = 'pendiente_encargado')
        or (auth.jwt() ->> 'role' = 'repartidor' and estado = 'pendiente_repartidor')
    )
);

drop policy if exists app_read_cobranzas_agenda on public.cobranzas_agenda;
create policy app_read_cobranzas_agenda on public.cobranzas_agenda
for select
using (
    auth.role() = 'authenticated'
    and (
        auth.jwt() ->> 'role' in ('admin', 'gerente', 'contador', 'cajero')
        or (
            auth.jwt() ->> 'role' in ('cobrador', 'encargado_cobranza')
            and (
                zona = coalesce(auth.jwt() ->> 'zona', zona)
            )
        )
    )
);

drop policy if exists app_read_tesoreria_pagos on public.tesoreria_pagos;
create policy app_read_tesoreria_pagos on public.tesoreria_pagos
for select
using (
    auth.role() = 'authenticated'
    and (
        auth.jwt() ->> 'role' in ('admin', 'gerente', 'contador')
        or (
            auth.jwt() ->> 'role' in ('cajero', 'encargado_cobranza')
            and sucursal_id::text = auth.jwt() ->> 'sucursal_id'
        )
    )
);

commit;
