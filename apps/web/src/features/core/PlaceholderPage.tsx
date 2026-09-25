import { PageHeader } from './PageHeader';

export function MembersPage() {
  return (
    <PlaceholderPage
      description="The API supports invitations; member-management UI is outside the current portfolio scope."
      eyebrow="Collaboration"
      title="Members"
    />
  );
}

export function SettingsPage() {
  return (
    <PlaceholderPage
      description="Account and workspace preferences are outside the current portfolio scope."
      eyebrow="Preferences"
      title="Settings"
    />
  );
}

function PlaceholderPage({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <>
      <PageHeader description={description} eyebrow={eyebrow} title={title} />
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-sm text-slate-500">
        This route is an explicitly documented extension point.
      </div>
    </>
  );
}
