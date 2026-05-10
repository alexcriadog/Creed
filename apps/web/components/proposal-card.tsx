'use client';

import { useState, useTransition } from 'react';
import { acceptProposal, rejectProposal, type ProposalRow } from '@/lib/actions/proposals';

const TYPE_LABEL: Record<ProposalRow['proposal_type'], string> = {
  training_session: 'Sesión propuesta',
  meal_target: 'Targets de macros',
  weight_target: 'Objetivo de peso',
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
