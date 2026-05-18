'use client';

import { useState, useTransition } from 'react';
import { acceptProposal, rejectProposal, type ProposalRow } from '@/lib/actions/proposals';

const TYPE_LABEL: Record<ProposalRow['proposal_type'], string> = {
  training_session: 'Sesión propuesta',
  meal_target: 'Targets de macros',
  weight_target: 'Objetivo de peso',
  training_program: 'Programa de entreno',
  session_update: 'Ajustes al plan',
};

const STATUS_BADGE: Record<ProposalRow['status'], { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'var(--color-accent)' },
  accepted: { label: 'Aceptado ✓', color: 'var(--color-status-green)' },
  rejected: { label: 'Rechazado', color: 'var(--color-text-muted)' },
};

export function ProposalCard({ proposal }: { proposal: ProposalRow }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const r = await acceptProposal(proposal.id);
      if (!r.ok) setError(r.error ?? 'Error');
    });
  }

  function onReject() {
    setError(null);
    startTransition(async () => {
      const r = await rejectProposal(proposal.id);
      if (!r.ok) setError(r.error ?? 'Error');
    });
  }

  const badge = STATUS_BADGE[proposal.status];
  const isPendingStatus = proposal.status === 'pending';

  return (
    <div
      className="surface-glass my-3 p-4"
      style={{ borderLeft: `3px solid ${badge.color}` }}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="text-label">
          {TYPE_LABEL[proposal.proposal_type]} · {proposal.agent}
        </span>
        <span
          className="shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 font-mono text-[length:var(--text-xs)] font-medium"
          style={{
            color: badge.color,
            background: `color-mix(in oklch, ${badge.color} 14%, transparent)`,
          }}
        >
          {badge.label}
        </span>
      </header>

      <ProposalBody proposal={proposal} />

      {proposal.rationale && (
        <p className="mt-3 text-[length:var(--text-sm)] italic text-[color:var(--color-text-secondary)]">
          {proposal.rationale}
        </p>
      )}

      {error && (
        <p className="mt-2 text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">
          {error}
        </p>
      )}

      {isPendingStatus && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={isPending}
            aria-busy={isPending || undefined}
            className="btn-feedback inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-1.5 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
            style={{
              background:
                'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
              boxShadow:
                'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
            }}
          >
            {isPending && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
                className="animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.2-8.55" />
              </svg>
            )}
            {isPending ? 'Aceptando…' : 'Aceptar'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isPending}
            className="btn-feedback rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-1.5 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-status-red)] hover:text-[color:var(--color-status-red)]"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

interface TrainingSessionPayload {
  scheduled_for?: string;
  type?: string;
  prescribed?: {
    blocks?: Array<{
      name?: string;
      exercises?: Array<{
        name?: string;
        sets?: number;
        reps?: number | string;
        rpe?: number;
        rest_s?: number;
        notes?: string;
      }>;
    }>;
  };
}

interface MealTargetPayload {
  daily_calories?: number;
  daily_protein_g?: number;
  daily_carbs_g?: number;
  daily_fat_g?: number;
  hydration_l?: number;
}

interface WeightTargetPayload {
  target_weight_kg?: number;
  target_date?: string;
}

function ProposalBody({ proposal }: { proposal: ProposalRow }) {
  if (proposal.proposal_type === 'training_session') {
    const p = proposal.payload as TrainingSessionPayload;
    const date = p.scheduled_for
      ? new Date(p.scheduled_for + 'T00:00:00').toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        })
      : '—';
    return (
      <div>
        <p className="font-medium text-[color:var(--color-text-primary)]">
          {date}
          {p.type ? ` · ${p.type}` : ''}
        </p>
        {p.prescribed?.blocks && p.prescribed.blocks.length > 0 && (
          <div className="mt-1 space-y-1 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
            {p.prescribed.blocks.map((b, i) => (
              <div key={i}>
                {b.name && (
                  <div className="font-mono text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    {b.name}
                  </div>
                )}
                <ul className="ml-3 list-disc">
                  {(b.exercises ?? []).map((ex, j) => (
                    <li key={j}>
                      {ex.name}
                      {ex.sets ? ` · ${ex.sets}×${ex.reps ?? '?'}` : ''}
                      {ex.rpe ? ` @RPE${ex.rpe}` : ''}
                      {ex.notes ? ` — ${ex.notes}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (proposal.proposal_type === 'meal_target') {
    const p = proposal.payload as MealTargetPayload;
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[length:var(--text-sm)] sm:grid-cols-5">
        {p.daily_calories !== undefined && <Stat label="kcal" value={`${p.daily_calories}`} />}
        {p.daily_protein_g !== undefined && <Stat label="prot" value={`${p.daily_protein_g}g`} />}
        {p.daily_carbs_g !== undefined && <Stat label="carbs" value={`${p.daily_carbs_g}g`} />}
        {p.daily_fat_g !== undefined && <Stat label="grasa" value={`${p.daily_fat_g}g`} />}
        {p.hydration_l !== undefined && <Stat label="agua" value={`${p.hydration_l}L`} />}
      </dl>
    );
  }
  if (proposal.proposal_type === 'session_update') {
    const p = proposal.payload as {
      updates?: Array<{
        session_id: string;
        type?: string;
        notes?: string;
      }>;
    };
    const updates = p.updates ?? [];
    return (
      <div>
        <p className="font-medium text-[color:var(--color-text-primary)]">
          {updates.length} cambio{updates.length === 1 ? '' : 's'} en tu plan
        </p>
        {updates.length > 0 && (
          <ul className="mt-2 ml-3 list-disc space-y-1 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
            {updates.slice(0, 4).map((u, i) => (
              <li key={i}>
                {u.type ? <strong>{u.type}</strong> : 'sesión'}
                {u.notes ? ` — ${u.notes}` : ''}
              </li>
            ))}
            {updates.length > 4 && (
              <li className="text-[color:var(--color-text-muted)]">
                +{updates.length - 4} más…
              </li>
            )}
          </ul>
        )}
      </div>
    );
  }
  if (proposal.proposal_type === 'training_program') {
    return <TrainingProgramBody payload={proposal.payload} />;
  }
  if (proposal.proposal_type === 'weight_target') {
    const p = proposal.payload as WeightTargetPayload;
    return (
      <p className="text-[color:var(--color-text-primary)]">
        Objetivo: <strong>{p.target_weight_kg ?? '—'} kg</strong>
        {p.target_date && (
          <span>
            {' '}
            para{' '}
            {new Date(p.target_date + 'T00:00:00').toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </p>
    );
  }
  return null;
}

interface ProgramSession {
  scheduled_for: string;
  type?: string;
  prescribed?: {
    blocks?: Array<{
      name?: string;
      exercises?: Array<{
        name?: string;
        sets?: number;
        reps?: number | string | null;
        rpe?: number | null;
        rest_s?: number | null;
        notes?: string | null;
      }>;
    }>;
  };
}

function TrainingProgramBody({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const p = payload as {
    program_type?: string;
    start_date?: string;
    period_weeks?: number;
    sessions_per_week?: number;
    minutes_per_session?: number;
    goal?: string;
    sessions?: ProgramSession[];
  };
  const sessions = p.sessions ?? [];
  const start = p.start_date
    ? new Date(p.start_date + 'T00:00:00').toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      })
    : '—';
  const weeks = p.period_weeks ?? 0;
  const byType: Record<string, number> = {};
  for (const s of sessions) {
    const t = s.type ?? 'otro';
    byType[t] = (byType[t] ?? 0) + 1;
  }

  // Detecta si es plantilla semanal (sessions cubren <7 días).
  const dates = sessions.map((s) =>
    new Date(s.scheduled_for + 'T00:00:00').getTime(),
  );
  const span =
    dates.length >= 2 ? (Math.max(...dates) - Math.min(...dates)) / 86_400_000 : 0;
  const isTemplate = span < 7 && weeks > 1;

  return (
    <div>
      <p className="font-medium text-[color:var(--color-text-primary)]">
        {weeks} semana{weeks === 1 ? '' : 's'} · desde {start} ·{' '}
        {p.sessions_per_week ?? sessions.length} sesiones/sem
        {p.minutes_per_session ? ` · ${p.minutes_per_session} min/sesión` : ''}
      </p>
      {p.program_type && (
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          tipo: {p.program_type}
        </p>
      )}
      {p.goal && (
        <p className="mt-1 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          {p.goal}
        </p>
      )}
      {Object.keys(byType).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(byType).map(([t, n]) => (
            <span
              key={t}
              className="rounded-[var(--radius-pill)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2 py-0.5 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)]"
            >
              {t} × {n}
            </span>
          ))}
        </div>
      )}
      {isTemplate && (
        <p className="mt-2 text-[10px] italic text-[color:var(--color-text-muted)]">
          Plantilla de una semana — se replicará en las {weeks} semanas.
        </p>
      )}
      {sessions.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="tap-feedback mt-3 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
        >
          <span aria-hidden>{expanded ? '▾' : '▸'}</span>
          {expanded ? 'Ocultar detalle' : 'Ver detalle de los ejercicios'}
        </button>
      )}
      {expanded && sessions.length > 0 && (
        <div className="mt-3 space-y-3 rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface)] p-3">
          {sessions.map((s, i) => {
            const date = s.scheduled_for
              ? new Date(s.scheduled_for + 'T00:00:00').toLocaleDateString(
                  'es-ES',
                  { weekday: 'short', day: 'numeric', month: 'short' },
                )
              : '—';
            const blocks = s.prescribed?.blocks ?? [];
            return (
              <div key={i}>
                <div className="mb-1 text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text-primary)]">
                  {date}
                  {s.type ? ` · ${s.type}` : ''}
                </div>
                {blocks.map((b, j) => (
                  <div key={j} className="mb-1.5">
                    {b.name && (
                      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        {b.name}
                      </div>
                    )}
                    <ul className="ml-3 list-disc text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)]">
                      {(b.exercises ?? []).map((ex, k) => (
                        <li key={k}>
                          <span className="font-medium text-[color:var(--color-text-primary)]">
                            {ex.name}
                          </span>
                          {ex.sets
                            ? ` · ${ex.sets}×${ex.reps ?? '?'}`
                            : ''}
                          {ex.rpe ? ` @RPE${ex.rpe}` : ''}
                          {ex.rest_s ? ` · ${ex.rest_s}s descanso` : ''}
                          {ex.notes ? ` — ${ex.notes}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label">{label}</dt>
      <dd className="font-mono text-[length:var(--text-base)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
      </dd>
    </div>
  );
}
