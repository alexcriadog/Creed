'use client';

import { useState, useTransition } from 'react';
import { updateModelAssignment, updateCostLimit } from '@/lib/actions/admin';
import type { ModelAssignment, CostLimit } from './page';

const KNOWN_MODELS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

const ALLOWED_FLOWS = [
  'nutritionist_chat',
  'trainer_chat',
  'orchestrator',
  'onboarding',
  'lapse_recovery',
  'weekly_close',
  'weekly_plan',
  'meal_parser',
  'conversation_compactor',
] as const;

type Flow = (typeof ALLOWED_FLOWS)[number];

const ALLOWED_SERVICES = ['anthropic', 'whoop', 'groq'] as const;
type Service = (typeof ALLOWED_SERVICES)[number];

export function ModelsForm({
  assignments,
  limits,
  flowLabels,
}: {
  assignments: ModelAssignment[];
  limits: CostLimit[];
  flowLabels: Record<string, string>;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Asignación de modelo por flujo
        </h2>
        <div className="space-y-2">
          {assignments.map((a) => (
            <AssignmentRow key={a.flow} assignment={a} flowLabels={flowLabels} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Límites de gasto mensual
        </h2>
        <div className="space-y-2">
          {limits.map((l) => (
            <LimitRow key={l.service} limit={l} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AssignmentRow({
  assignment,
  flowLabels,
}: {
  assignment: ModelAssignment;
  flowLabels: Record<string, string>;
}) {
  const [model, setModel] = useState(assignment.model);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = model !== assignment.model;

  function save() {
    setError(null);
    if (!ALLOWED_FLOWS.includes(assignment.flow as Flow)) {
      setError('Flow no soportado');
      return;
    }
    startTransition(async () => {
      const result = await updateModelAssignment({
        flow: assignment.flow as Flow,
        model,
      });
      if (!result.ok) setError(result.error ?? 'Error');
      else setSavedAt(new Date().toLocaleTimeString('es-ES'));
    });
  }

  const isCustom = !KNOWN_MODELS.includes(model);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          {flowLabels[assignment.flow] ?? assignment.flow}
        </p>
        <p className="font-mono text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {assignment.flow}
        </p>
      </div>
      <select
        value={isCustom ? '__custom__' : model}
        onChange={(e) => {
          if (e.target.value === '__custom__') return;
          setModel(e.target.value);
        }}
        className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2 py-1 font-mono text-[length:var(--text-xs)] outline-none focus:border-[color:var(--color-accent)]"
      >
        {KNOWN_MODELS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        {isCustom && (
          <option value="__custom__" disabled>
            (custom: {model})
          </option>
        )}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || isPending}
        aria-busy={isPending || undefined}
        className="btn-feedback inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-1 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-on-accent)] hover:bg-[color:var(--color-accent-strong)]"
      >
        {isPending && (
          <svg
            width="11"
            height="11"
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
        {isPending ? 'Guardando' : 'Guardar'}
      </button>
      {savedAt && !dirty && (
        <span className="text-[length:var(--text-xs)] text-[color:var(--color-status-green)]">
          ✓ {savedAt}
        </span>
      )}
      {error && (
        <span className="text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">
          {error}
        </span>
      )}
    </div>
  );
}

function LimitRow({ limit }: { limit: CostLimit }) {
  const [cap, setCap] = useState(String(limit.monthly_cap_eur));
  const [alarm, setAlarm] = useState(String(limit.alarm_threshold_pct));
  const [pause, setPause] = useState(limit.pause_at_cap);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    cap !== String(limit.monthly_cap_eur) ||
    alarm !== String(limit.alarm_threshold_pct) ||
    pause !== limit.pause_at_cap;

  function save() {
    setError(null);
    const capN = Number(cap);
    const alarmN = Number(alarm);
    if (!Number.isFinite(capN) || capN < 0) {
      setError('Cap inválido');
      return;
    }
    if (!Number.isInteger(alarmN) || alarmN < 1 || alarmN > 100) {
      setError('Alarma inválida (1-100)');
      return;
    }
    if (!ALLOWED_SERVICES.includes(limit.service as Service)) {
      setError('Servicio no soportado');
      return;
    }
    startTransition(async () => {
      const result = await updateCostLimit({
        service: limit.service as Service,
        monthlyCapEur: capN,
        alarmThresholdPct: alarmN,
        pauseAtCap: pause,
      });
      if (!result.ok) setError(result.error ?? 'Error');
      else setSavedAt(new Date().toLocaleTimeString('es-ES'));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--text-sm)] capitalize text-[color:var(--color-text-secondary)]">
          {limit.service}
        </p>
      </div>
      <label className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
        Cap €
        <input
          type="number"
          min="0"
          step="1"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          className="ml-1 w-20 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2 py-1 font-mono text-[length:var(--text-sm)] tabular-nums outline-none focus:border-[color:var(--color-accent)]"
        />
      </label>
      <label className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
        Alarma %
        <input
          type="number"
          min="1"
          max="100"
          step="1"
          value={alarm}
          onChange={(e) => setAlarm(e.target.value)}
          className="ml-1 w-16 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2 py-1 font-mono text-[length:var(--text-sm)] tabular-nums outline-none focus:border-[color:var(--color-accent)]"
        />
      </label>
      <label className="flex items-center gap-1 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={pause}
          onChange={(e) => setPause(e.target.checked)}
        />
        Pausar al cap
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || isPending}
        aria-busy={isPending || undefined}
        className="btn-feedback inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-1 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-on-accent)] hover:bg-[color:var(--color-accent-strong)]"
      >
        {isPending && (
          <svg
            width="11"
            height="11"
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
        {isPending ? 'Guardando' : 'Guardar'}
      </button>
      {savedAt && !dirty && (
        <span className="text-[length:var(--text-xs)] text-[color:var(--color-status-green)]">
          ✓ {savedAt}
        </span>
      )}
      {error && (
        <span className="text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">
          {error}
        </span>
      )}
    </div>
  );
}
