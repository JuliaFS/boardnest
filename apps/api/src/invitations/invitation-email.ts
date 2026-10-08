export interface WorkspaceInvitationEmail {
  email: string;
  inviterName: string;
  token: string;
  workspaceName: string;
}

export interface InvitationEmailService {
  sendWorkspaceInvitation: (
    invitation: WorkspaceInvitationEmail,
  ) => Promise<void>;
}

interface ResendInvitationEmailOptions {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  from: string;
  webUrl: string;
}

export function createResendInvitationEmailService({
  apiKey,
  fetchImplementation = fetch,
  from,
  webUrl,
}: ResendInvitationEmailOptions): InvitationEmailService {
  return {
    async sendWorkspaceInvitation(invitation) {
      const acceptUrl = `${webUrl.replace(/\/$/, '')}/invite/${encodeURIComponent(invitation.token)}`;
      const workspaceName = escapeHtml(invitation.workspaceName);
      const inviterName = escapeHtml(invitation.inviterName);
      const response = await fetchImplementation(
        'https://api.resend.com/emails',
        {
          body: JSON.stringify({
            from,
            html: `<p>${inviterName} invited you to join <strong>${workspaceName}</strong> on Boardnest.</p><p><a href="${escapeHtml(acceptUrl)}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
            subject: `Join ${invitation.workspaceName} on Boardnest`,
            text: `${invitation.inviterName} invited you to join ${invitation.workspaceName} on Boardnest. Accept the invitation: ${acceptUrl}\n\nThis link expires in 7 days.`,
            to: [invitation.email],
          }),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Resend rejected the invitation email with HTTP ${response.status}.`,
        );
      }
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '"': '&quot;',
        '&': '&amp;',
        "'": '&#039;',
        '<': '&lt;',
        '>': '&gt;',
      })[character] ?? character,
  );
}
