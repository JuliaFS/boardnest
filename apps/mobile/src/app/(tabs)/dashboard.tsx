import { FoundationScreen } from '@/components/foundation-screen';

export default function DashboardScreen() {
  return (
    <FoundationScreen
      eyebrow="MOBILE FOUNDATION"
      title="Welcome to Boardnest"
      description="The native client is ready for authentication and GraphQL integration."
      items={[
        'Expo Router navigation is configured.',
        'Boardnest design tokens are available.',
        'Android, iOS, and web development targets are enabled.',
      ]}
    />
  );
}
