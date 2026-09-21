import { PageHeader } from './PageHeader';

export function MembersPage() {
  return (
    <PlaceholderPage
      description="Workspace member and invitation management will be connected alongside project workflows in Phase 6."
      eyebrow="Collaboration"
      title="Members"
    />
  );
}

export function SettingsPage() {
  return (
    <PlaceholderPage
      description="Account and workspace preferences will be added after the core project workflow is complete."
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
        This route is ready for its feature implementation.
      </div>
    </>
  );
}
