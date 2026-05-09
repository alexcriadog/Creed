import { listPendingProposals } from '@/lib/actions/proposals';
import { ProposalCard } from './proposal-card';

export async function PendingProposals() {
  const proposals = await listPendingProposals(5);
  if (proposals.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
        Propuestas pendientes ({proposals.length})
      </h2>
      <div className="space-y-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
    </section>
  );
}
