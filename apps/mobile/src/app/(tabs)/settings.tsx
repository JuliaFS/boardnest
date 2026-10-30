import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FoundationScreen } from '@/components/foundation-screen';
import {
  deleteMobileAccount,
  getAccountDeletionImpact,
  type AccountDeletionImpact,
} from '@/features/auth/account-deletion-client';
import { useMobileAuth } from '@/features/auth/mobile-auth';
import { theme } from '@/theme';

export default function SettingsScreen() {
  const { signOut, user } = useMobileAuth();
  const [impact, setImpact] = useState<AccountDeletionImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [deleteWorkspaceIds, setDeleteWorkspaceIds] = useState<Set<string>>(
    new Set(),
  );
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void getAccountDeletionImpact()
      .then(setImpact)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load account settings.',
        );
      });
  }, []);

  const planComplete = useMemo(
    () =>
      impact?.ownedWorkspaces.every((workspace) => {
        if (workspace.ownershipStatus === 'deletion_required') {
          return deleteWorkspaceIds.has(workspace.id);
        }
        if (workspace.ownershipStatus === 'transfer_required') {
          return Boolean(transfers[workspace.id]);
        }
        return true;
      }) ?? false,
    [deleteWorkspaceIds, impact, transfers],
  );

  async function handleDeleteAccount() {
    if (!impact || confirmation !== 'DELETE' || !planComplete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMobileAccount({
        confirmation: 'DELETE',
        deleteWorkspaceIds: [...deleteWorkspaceIds],
        transfers,
      });
      await signOut();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Account deletion failed.',
      );
      setDeleting(false);
    }
  }

  return (
    <FoundationScreen
      description="Manage the mobile session and permanently delete your Boardnest account."
      eyebrow="ACCOUNT"
      items={[
        `Signed in as ${user?.email ?? user?.id ?? 'unknown user'}`,
        'Session encrypted on this device',
        'Automatic access-token refresh',
      ]}
      title="Settings"
    >
      <Pressable onPress={() => void signOut()} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Permanently delete account</Text>
        <Text style={styles.body}>
          Memberships, assignments, reminders, and private notification data
          will be removed. Every owned workspace must be transferred or deleted.
        </Text>

        {!impact && !error ? (
          <Text style={styles.body}>Loading impact…</Text>
        ) : null}
        {impact?.ownedWorkspaces.map((workspace) => (
          <View key={workspace.id} style={styles.workspaceCard}>
            <Text style={styles.workspaceTitle}>{workspace.name}</Text>
            <Text style={styles.body}>
              {workspace.projectCount} projects · {workspace.taskCount} tasks
            </Text>
            {workspace.ownershipStatus === 'deletion_required' ? (
              <Pressable
                onPress={() =>
                  setDeleteWorkspaceIds((current) => {
                    const next = new Set(current);
                    if (next.has(workspace.id)) next.delete(workspace.id);
                    else next.add(workspace.id);
                    return next;
                  })
                }
                style={styles.choice}
              >
                <Text style={styles.choiceText}>
                  {deleteWorkspaceIds.has(workspace.id) ? '☑' : '☐'} Delete this
                  workspace
                </Text>
              </Pressable>
            ) : null}
            {workspace.ownershipStatus === 'transfer_required' ? (
              <View style={styles.choices}>
                <Text style={styles.body}>Transfer ownership to:</Text>
                {workspace.eligibleSuccessors.map((successor) => (
                  <Pressable
                    key={successor.id}
                    onPress={() =>
                      setTransfers((current) => ({
                        ...current,
                        [workspace.id]: successor.id,
                      }))
                    }
                    style={styles.choice}
                  >
                    <Text style={styles.choiceText}>
                      {transfers[workspace.id] === successor.id ? '●' : '○'}{' '}
                      {successor.displayName} ({successor.role})
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {workspace.ownershipStatus === 'shared_owner' ? (
              <Text style={styles.success}>
                Another owner will retain this workspace.
              </Text>
            ) : null}
          </View>
        ))}

        <Text style={styles.label}>Type DELETE to confirm</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setConfirmation}
          style={styles.input}
          value={confirmation}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={deleting || confirmation !== 'DELETE' || !planComplete}
          onPress={() => void handleDeleteAccount()}
          style={({ pressed }) => [
            styles.dangerButton,
            (pressed || deleting || !planComplete) && styles.disabled,
          ]}
        >
          <Text style={styles.dangerButtonText}>
            {deleting ? 'Deleting…' : 'Delete account permanently'}
          </Text>
        </Pressable>
      </View>
    </FoundationScreen>
  );
}

const styles = StyleSheet.create({
  body: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 21 },
  choice: { paddingVertical: theme.spacing.sm },
  choiceText: { color: theme.colors.text, fontSize: 14 },
  choices: { gap: theme.spacing.xs },
  dangerButton: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.danger,
    padding: theme.spacing.md,
  },
  dangerButtonText: { color: theme.colors.primaryContrast, fontWeight: '800' },
  dangerCard: {
    gap: theme.spacing.md,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  dangerTitle: { color: theme.colors.danger, fontSize: 20, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  error: { color: theme.colors.danger, fontSize: 14 },
  input: {
    minHeight: 48,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
  },
  label: { color: theme.colors.text, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  secondaryButtonText: { color: theme.colors.text, fontWeight: '700' },
  success: { color: theme.colors.success, fontSize: 14 },
  workspaceCard: {
    gap: theme.spacing.sm,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  workspaceTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
