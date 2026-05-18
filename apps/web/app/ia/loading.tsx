import { PageSkeleton } from '@/components/page-skeleton';

export default function ChatLoading() {
  return <PageSkeleton hero={false} metrics={false} list bottomNav />;
}
