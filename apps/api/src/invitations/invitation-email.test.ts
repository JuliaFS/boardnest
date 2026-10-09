import { describe, expect, it, vi } from 'vitest';

import {
  createResendInvitationEmailService,
  createSmtpInvitationEmailService,
} from './invitation-email.js';

describe('Resend invitation email service', () => {
  it('sends an escaped invitation with a token link', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 200 }),
      ) as unknown as typeof fetch;
    const service = createResendInvitationEmailService({
      apiKey: 're_test',
      fetchImplementation,
      from: 'Boardnest <invites@example.com>',
      webUrl: 'https://boardnest.example/',
    });

    await service.sendWorkspaceInvitation({
      email: 'member@example.com',
      inviterName: 'Owner <Admin>',
      token: 'token_value',
      workspaceName: 'Product & Design',
    });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = (fetchImplementation as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    if (typeof init.body !== 'string') throw new Error('Expected JSON body.');
    const body = JSON.parse(init.body) as {
      html: string;
      text: string;
      to: string[];
    };
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test' });
    expect(body.to).toEqual(['member@example.com']);
    expect(body.html).toContain('Owner &lt;Admin&gt;');
    expect(body.html).toContain('Product &amp; Design');
    expect(body.text).toContain('https://boardnest.example/invite/token_value');
  });

  it('fails without exposing the response body', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(
        new Response('provider detail', { status: 422 }),
      ) as unknown as typeof fetch;
    const service = createResendInvitationEmailService({
      apiKey: 're_test',
      fetchImplementation,
      from: 'invites@example.com',
      webUrl: 'https://boardnest.example',
    });

    await expect(
      service.sendWorkspaceInvitation({
        email: 'member@example.com',
        inviterName: 'Owner',
        token: 'token',
        workspaceName: 'Product',
      }),
    ).rejects.toThrow('HTTP 422');
  });
});

describe('SMTP invitation email service', () => {
  it('sends an escaped invitation through the injected transport', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
    const service = createSmtpInvitationEmailService({
      from: 'Boardnest <boardnest@gmail.com>',
      host: 'smtp.gmail.com',
      password: 'app-password',
      port: 465,
      secure: true,
      transport: { sendMail },
      user: 'boardnest@gmail.com',
      webUrl: 'https://boardnest.example/',
    });

    await service.sendWorkspaceInvitation({
      email: 'member@example.com',
      inviterName: 'Owner <Admin>',
      token: 'token/value',
      workspaceName: 'Product & Design',
    });

    expect(sendMail).toHaveBeenCalledOnce();
    const message = sendMail.mock.calls[0]?.[0] as
      | {
          from: string;
          html: string;
          text: string;
          to: string;
        }
      | undefined;
    expect(message).toBeDefined();
    expect(message?.from).toBe('Boardnest <boardnest@gmail.com>');
    expect(message?.html).toContain('Product &amp; Design');
    expect(message?.text).toContain(
      'https://boardnest.example/invite/token%2Fvalue',
    );
    expect(message?.to).toBe('member@example.com');
  });

  it('propagates delivery failures to the invitation fallback flow', async () => {
    const transportError = new Error('SMTP unavailable');
    const service = createSmtpInvitationEmailService({
      from: 'boardnest@gmail.com',
      host: 'smtp.gmail.com',
      password: 'app-password',
      port: 465,
      secure: true,
      transport: { sendMail: vi.fn().mockRejectedValue(transportError) },
      user: 'boardnest@gmail.com',
      webUrl: 'https://boardnest.example',
    });

    await expect(
      service.sendWorkspaceInvitation({
        email: 'member@example.com',
        inviterName: 'Owner',
        token: 'token',
        workspaceName: 'Product',
      }),
    ).rejects.toBe(transportError);
  });
});
