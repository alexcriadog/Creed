import { PageSkeleton } from '@/components/page-skeleton';

export default function ProfileLoading() {
  return <PageSkeleton hero={false} metrics={false} list bottomNav />;
}
