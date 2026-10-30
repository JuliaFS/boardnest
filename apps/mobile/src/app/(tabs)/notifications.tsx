import { AppBanner, AppScreen, EmptyState } from '@/components/ui';

export default function NotificationsScreen() {
  return (
    <AppScreen
      eyebrow="NOTIFICATIONS"
      title="Notification inbox"
      description="In-app notifications, reminders, and delivery preferences will be added in a later mobile phase."
    >
      <AppBanner
        message="Notification delivery is active on the API. The native inbox will reuse the same safe routes and preferences as the web client."
        title="Mobile inbox foundation"
      />
      <EmptyState
        description="New notifications will appear here after the mobile inbox operations are connected."
        title="No notifications"
      />
    </AppScreen>
  );
}
