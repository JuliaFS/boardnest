import nodemailer from 'nodemailer';

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

interface InvitationMessage {
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}

interface MailTransport {
  sendMail: (message: InvitationMessage) => Promise<unknown>;
}

interface SmtpInvitationEmailOptions {
  from: string;
  host: string;
  password: string;
  port: number;
  secure: boolean;
  transport?: MailTransport;
  user: string;
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
      const message = createInvitationMessage(invitation, from, webUrl);
      const response = await fetchImplementation(
        'https://api.resend.com/emails',
        {
          body: JSON.stringify({
            ...message,
            to: [message.to],
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

export function createSmtpInvitationEmailService({
  from,
  host,
  password,
  port,
  secure,
  user,
  transport = nodemailer.createTransport({
    auth: { pass: password, user },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    host,
    port,
    secure,
    socketTimeout: 10_000,
  }),
  webUrl,
}: SmtpInvitationEmailOptions): InvitationEmailService {
  return {
    async sendWorkspaceInvitation(invitation) {
      await transport.sendMail(
        createInvitationMessage(invitation, from, webUrl),
      );
    },
  };
}

function createInvitationMessage(
  invitation: WorkspaceInvitationEmail,
  from: string,
  webUrl: string,
): InvitationMessage {
  const acceptUrl = `${webUrl.replace(/\/$/, '')}/invite/${encodeURIComponent(invitation.token)}`;
  const workspaceName = escapeHtml(invitation.workspaceName);
  const inviterName = escapeHtml(invitation.inviterName);

  return {
    from,
    html: `<p>${inviterName} invited you to join <strong>${workspaceName}</strong> on Boardnest.</p><p><a href="${escapeHtml(acceptUrl)}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    subject: `Join ${invitation.workspaceName} on Boardnest`,
    text: `${invitation.inviterName} invited you to join ${invitation.workspaceName} on Boardnest. Accept the invitation: ${acceptUrl}\n\nThis link expires in 7 days.`,
    to: invitation.email,
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
