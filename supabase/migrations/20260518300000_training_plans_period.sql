-- training_plans: pasar de planes semanales sueltos a programas (mesociclos)
-- de 4-12 semanas. Añadimos period_weeks + period_end y reforzamos la unicidad
-- de "programa activo" a una sola fila por usuario.

alter table training_plans
  add column if not exists period_weeks int not null default 1
    check (period_weeks between 1 and 12);

alter table training_plans
  add column if not exists period_end date;

-- Antes de crear el unique parcial, limpiar duplicados activos por usuario
-- (no debería haber en este momento, pero por defensa).
update training_plans
   set status = 'superseded'
 where status = 'active'
   and id in (
     select id from (
       select id,
              row_number() over (
                partition by user_id
                order by created_at desc, week_start desc
              ) as rn
         from training_plans
        where status = 'active'
     ) t
     where t.rn > 1
   );

-- Drop unique anterior si existe, y crear unique parcial "un solo activo".
drop index if exists training_plans_user_week_status_unique;
alter table training_plans
  drop constraint if exists training_plans_user_id_week_start_status_key;

drop index if exists training_plans_user_active_unique;
create unique index training_plans_user_active_unique
  on training_plans (user_id) where status = 'active';
