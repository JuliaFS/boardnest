import { FoundationScreen } from '@/components/foundation-screen';

export default function SettingsScreen() {
  return (
    <FoundationScreen
      eyebrow="SETTINGS"
      title="Account settings"
      description="Authentication, session management, and account deletion will be connected after the API supports mobile bearer tokens."
      items={[
        'Profile and session',
        'Notification preferences',
        'Account lifecycle',
      ]}
    />
  );
}
