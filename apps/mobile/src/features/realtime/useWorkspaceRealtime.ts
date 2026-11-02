import { MobileWorkspaceMembershipChangedDocument } from '@boardnest/graphql-types';
import { useSubscription } from '@apollo/client/react';
import { useEffect, useRef } from 'react';

import { createEventDeduplicator } from '@/lib/realtime-events';

export function useWorkspaceRealtime(
  workspaceId: string,
  onMembershipChanged: () => void,
): void {
  const deduplicator = useRef(createEventDeduplicator());
  const membership = useSubscription(MobileWorkspaceMembershipChangedDocument, {
    skip: !workspaceId,
    variables: { workspaceId },
  });

  useEffect(() => {
    const event = membership.data?.workspaceMembershipChanged;
    if (event && deduplicator.current.accept(event.id)) {
      onMembershipChanged();
    }
  }, [membership.data, onMembershipChanged]);
}
