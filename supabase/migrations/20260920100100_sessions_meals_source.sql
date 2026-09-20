-- Entrenos que entran por texto libre (WhatsApp → Claude → MCP) y comidas
-- estimadas por Claude. Spec: docs/superpowers/specs/2026-09-20-creed-mcp-design.md §3

alter table public.sessions drop constraint if exists sessions_source_check;
alter table public.sessions add constraint sessions_source_check
  check (source in ('manual', 'whoop', 'coach', 'text'));

alter table public.meals
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'claude', 'parser')),
  add column if not exists confidence text not null default 'estimated'
    check (confidence in ('estimated', 'measured'));

comment on column public.meals.source is 'manual = formulario web; claude = tool log_meal del MCP; parser = parser LLM legado.';
comment on column public.meals.confidence is 'estimated = kcal/macros estimados; measured = pesado/medido.';
