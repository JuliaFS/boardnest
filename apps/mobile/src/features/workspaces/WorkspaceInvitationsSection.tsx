import {
  InviteMobileWorkspaceMemberDocument,
  ChangeMobileInvitationEmailDocument,
  MobileWorkspaceInvitationsDocument,
  RevokeMobileWorkspaceInvitationDocument,
  type WorkspaceRole,
} from '@boardnest/graphql-types';
import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  AppTextField,
  BottomSheetModal,
  ErrorState,
  LoadingState,
} from '@/components/ui';
import { mobileEnvironment } from '@/lib/environment';
import { theme } from '@/theme';

const roles: Exclude<WorkspaceRole, 'OWNER'>[] = ['ADMIN', 'MEMBER', 'VIEWER'];

type InvitationResult = {
  emailChanged?: boolean;
  email: string;
  emailSent: boolean;
  token?: string | null;
};

export function WorkspaceInvitationsSection({
  isAnonymous,
  workspaceId,
}: {
  isAnonymous: boolean;
  workspaceId: string;
}) {
  const [editingInvitation, setEditingInvitation] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<WorkspaceRole, 'OWNER'>>('MEMBER');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationResult | null>(null);
  const invitations = useQuery(MobileWorkspaceInvitationsDocument, {
    variables: { workspaceId },
  });
  const [inviteMember, invitationState] = useMutation(
    InviteMobileWorkspaceMemberDocument,
  );
  const [changeEmail, changeState] = useMutation(
    ChangeMobileInvitationEmailDocument,
  );
  const [revokeInvitation, revokeState] = useMutation(
    RevokeMobileWorkspaceInvitationDocument,
  );
  const nodes = invitations.data?.workspaceInvitations.nodes ?? [];
  const guestLimitReached = isAnonymous && nodes.length >= 1;

  async function submitInvitation() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);
    try {
      const refresh = [
        {
          query: MobileWorkspaceInvitationsDocument,
          variables: { workspaceId },
        },
      ];
      const response = editingInvitation
        ? await changeEmail({
            refetchQueries: refresh,
            variables: { id: editingInvitation.id, email: normalizedEmail },
          })
        : await inviteMember({
            refetchQueries: [
              {
                query: MobileWorkspaceInvitationsDocument,
                variables: { workspaceId },
              },
            ],
            variables: {
              input: { email: normalizedEmail, role, workspaceId },
            },
          });
      const payload = response.data?.inviteMember;
      if (!payload) return;
      setShowInvite(false);
      setEditingInvitation(null);
      setResult({
        emailChanged: Boolean(editingInvitation),
        email: payload.invitation.email,
        emailSent: payload.emailSent,
        token: payload.token,
      });
      setEmail('');
      setRole('MEMBER');
    } catch {
      // Apollo exposes the actionable GraphQL error through invitationState.
    }
  }

  async function revoke(id: string) {
    try {
      await revokeInvitation({
        refetchQueries: [
          {
            query: MobileWorkspaceInvitationsDocument,
            variables: { workspaceId },
          },
        ],
        variables: { id },
      });
    } catch {
      // Apollo exposes the actionable GraphQL error through revokeState.
    }
  }

  const invitationLink = result?.token
    ? `${mobileEnvironment.webUrl.replace(/\/$/, '')}/invite/${encodeURIComponent(result.token)}`
    : null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Pending invitations
        </Text>
        <Text style={styles.help}>
          Invitation links expire after seven days and are restricted to the
          invited email address.
        </Text>
      </View>
      <AppButton
        disabled={guestLimitReached}
        label="Invite workspace member"
        onPress={() => {
          setEditingInvitation(null);
          setEmail('');
          setEmailError(null);
          setShowInvite(true);
        }}
        variant="secondary"
      />
      {guestLimitReached ? (
        <AppBanner
          message="Guest accounts can create one invitation. Use a registered account for ongoing collaboration."
          title="Invitation limit reached"
          tone="warning"
        />
      ) : null}
      {invitations.loading && !invitations.data ? (
        <LoadingState title="Loading invitations" />
      ) : invitations.error && !invitations.data ? (
        <ErrorState
          actionLabel="Try again"
          description={invitations.error.message}
          onAction={() => void invitations.refetch()}
          title="Invitations could not be loaded"
        />
      ) : nodes.length > 0 ? (
        <View style={styles.list}>
          {nodes.map((invitation) => (
            <View key={invitation.id} style={styles.card}>
              <Text style={styles.email}>{invitation.email}</Text>
              <Text style={styles.help}>
                {roleLabel(invitation.role)} · expires{' '}
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </Text>
              {!isAnonymous ? (
                <AppButton
                  label="Change email"
                  variant="secondary"
                  onPress={() => {
                    setEditingInvitation(invitation);
                    setEmail(invitation.email);
                    setEmailError(null);
                    setShowInvite(true);
                  }}
                />
              ) : null}
              <AppButton
                label="Revoke invitation"
                loading={revokeState.loading}
                onPress={() => void revoke(invitation.id)}
                variant="secondary"
              />
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>There are no pending invitations.</Text>
      )}
      {revokeState.error ? (
        <AppBanner
          message={revokeState.error.message}
          title="Invitation could not be revoked"
          tone="error"
        />
      ) : null}
      <BottomSheetModal
        description={
          editingInvitation
            ? 'An invitation will be sent to the updated email address. The previous link will no longer work.'
            : 'Choose the maximum workspace permissions for the invited account.'
        }
        onClose={() => setShowInvite(false)}
        title={
          editingInvitation
            ? 'Change invitation email'
            : 'Invite workspace member'
        }
        visible={showInvite}
      >
        <View style={styles.form}>
          <AppTextField
            autoCapitalize="none"
            autoCorrect={false}
            error={emailError}
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            value={email}
          />
          {!editingInvitation ? (
            <>
              <Text style={styles.help}>Workspace role</Text>
              {roles.map((option) => (
                <AppButton
                  key={option}
                  label={roleLabel(option)}
                  onPress={() => setRole(option)}
                  variant={role === option ? 'primary' : 'secondary'}
                />
              ))}
            </>
          ) : null}
          {(editingInvitation ? changeState.error : invitationState.error) ? (
            <AppBanner
              message={
                (editingInvitation ? changeState.error : invitationState.error)
                  ?.message ?? 'The invitation could not be saved.'
              }
              title="Invitation could not be created"
              tone="error"
            />
          ) : null}
          <AppButton
            label={editingInvitation ? 'Save email' : 'Send invitation'}
            loading={invitationState.loading || changeState.loading}
            onPress={() => void submitInvitation()}
          />
        </View>
      </BottomSheetModal>
      <BottomSheetModal
        description={
          result?.emailSent
            ? `The invitation was emailed to ${result.email}.`
            : `Email delivery was unavailable. Share this one-time link securely with ${result?.email ?? 'the invited user'}.`
        }
        onClose={() => setResult(null)}
        title={
          result?.emailChanged
            ? 'Invitation email changed'
            : 'Invitation created'
        }
        visible={Boolean(result)}
      >
        <View style={styles.form}>
          {invitationLink ? (
            <Text selectable style={styles.link}>
              {invitationLink}
            </Text>
          ) : (
            <AppBanner
              message="The invitation email contains the acceptance link."
              title="Email sent"
              tone="success"
            />
          )}
          <AppButton label="Done" onPress={() => setResult(null)} />
        </View>
      </BottomSheetModal>
    </View>
  );
}

function roleLabel(role: string): string {
  return role[0] + role.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  email: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  empty: {
    color: theme.colors.textMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.lg,
    textAlign: 'center',
  },
  form: { gap: theme.spacing.md },
  heading: { gap: theme.spacing.xs },
  help: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  link: {
    color: theme.colors.primary,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  list: { gap: theme.spacing.md },
  section: { gap: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
});
