import { FoundationScreen } from '@/components/foundation-screen';

export default function NotificationsScreen() {
  return (
    <FoundationScreen
      eyebrow="NOTIFICATIONS"
      title="Notification inbox"
      description="In-app notifications, reminders, and delivery preferences will be added in a later mobile phase."
      items={[
        'Unread notifications',
        'Safe internal navigation',
        'Reminder preferences',
      ]}
    />
  );
}
