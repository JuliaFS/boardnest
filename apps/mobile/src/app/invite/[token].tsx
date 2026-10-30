import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { FoundationScreen } from '@/components/foundation-screen';

export default function InvitationDeepLinkScreen() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const invitationToken = Array.isArray(token) ? token[0] : token;

  return (
    <FoundationScreen
      description="The invitation deep link reached the authenticated mobile application. Invitation acceptance will reuse the shared GraphQL operation in the projects stage."
      eyebrow="Invitation"
      items={[
        'Protected deep link',
        'Session restored',
        'Token captured safely',
      ]}
      title="Workspace invitation"
    >
      <Text selectable>
        {invitationToken
          ? 'Invitation ready to accept.'
          : 'Invalid invitation link.'}
      </Text>
    </FoundationScreen>
  );
}
