-- ColliTech: configuración de reseñas con moderación
-- Ejecuta este SQL en Supabase > SQL Editor si tu tabla reviews todavía
-- NO tiene la columna approved.

alter table public.reviews
add column if not exists approved boolean not null default false;

-- Las reseñas aprobadas pueden ser leídas por la web.
drop policy if exists "Public can read approved reviews" on public.reviews;
create policy "Public can read approved reviews"
on public.reviews
for select
to anon, authenticated
using (approved = true);

-- Cualquiera puede enviar una reseña, pero entra como approved=false.
drop policy if exists "Public can submit reviews" on public.reviews;
create policy "Public can submit reviews"
on public.reviews
for insert
to anon, authenticated
with check (approved = false);

-- IMPORTANTE:
-- No crees una policy pública para UPDATE que permita a cualquiera poner
-- approved=true. La aprobación debe hacerse desde Supabase como administrador.
