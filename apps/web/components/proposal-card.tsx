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
      className="my-3 rounded-[var(--radius-md)] border bg-[color:var(--color-surface-raised)] p-3"
      style={{
        borderColor: badge.color,
        background: `color-mix(in oklch, ${badge.color} 6%, transparent)`,
      }}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {TYPE_LABEL[proposal.proposal_type]} · {proposal.agent}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[length:var(--text-xs)] font-medium"
          style={{
            color: badge.color,
            background: `color-mix(in oklch, ${badge.color} 12%, transparent)`,
          }}
        >
          {badge.label}
        </span>
      </header>

      <ProposalBody proposal={proposal} />

      {proposal.rationale && (
        <p className="mt-2 text-[length:var(--text-sm)] italic text-[color:var(--color-text-secondary)]">
          {proposal.rationale}
        </p>
      )}

      {error && (
        <p className="mt-2 text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">
          {error}
        </p>
      )}

      {isPendingStatus && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={isPending}
            className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-1.5 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)] disabled:opacity-50"
          >
            {isPending ? '…' : 'Aceptar'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isPending}
            className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1.5 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-status-red)] hover:text-[color:var(--color-status-red)] disabled:opacity-50"
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
      <dt className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="font-mono tabular-nums text-[color:var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
