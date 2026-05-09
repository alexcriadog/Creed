import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: string;
}

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value, updated_at')
    .order('key', { ascending: true });

  if (error) {
    return (
      <p className="text-[length:var(--text-sm)] text-[color:var(--color-status-red)]">
        Error: {error.message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
        Umbrales numéricos que controlan el veredicto, calorías mínimas, compactación, etc.
        Cualquier cambio queda registrado en <code>audit_log</code>.
      </p>
      <SettingsForm settings={(data ?? []) as AppSetting[]} />
    </div>
  );
}
