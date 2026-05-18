'use client';

import { useState } from 'react';
import { Sheet } from './sheet';
import { ProposalCard } from './proposal-card';
import type { ProposalRow } from '@/lib/actions/proposals';

interface PendingProposalsBannerProps {
  proposals: ProposalRow[];
}

export function PendingProposalsBanner({ proposals }: PendingProposalsBannerProps) {
  const [open, setOpen] = useState(false);
  if (proposals.length === 0) return null;

  const count = proposals.length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-feedback inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-[length:var(--text-xs)] font-medium transition"
        style={{
          borderColor: 'var(--color-accent)',
          background:
            'color-mix(in oklch, var(--color-accent) 14%, transparent)',
          color: 'var(--color-accent)',
        }}
        aria-label={`Tienes ${count} propuesta${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'}`}
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 animate-pulse rounded-full"
          style={{ background: 'var(--color-accent)' }}
        />
        {count} pendiente{count === 1 ? '' : 's'}
        <span aria-hidden>›</span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Propuestas (${count})`}
      >
        <div className="space-y-3">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      </Sheet>
    </>
  );
}
