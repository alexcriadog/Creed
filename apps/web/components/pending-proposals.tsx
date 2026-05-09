import { listPendingProposals } from '@/lib/actions/proposals';
import { ProposalCard } from './proposal-card';

export async function PendingProposals() {
  const proposals = await listPendingProposals(5);
  if (proposals.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-label mb-3">PROPUESTAS · {proposals.length} PENDIENTES</h2>
      <div className="space-y-2">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
    </section>
  );
}
