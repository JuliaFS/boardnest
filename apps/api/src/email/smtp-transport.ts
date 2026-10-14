import nodemailer from 'nodemailer';

export interface EmailMessage {
  from: string;
  headers?: Record<string, string>;
  html: string;
  messageId?: string;
  subject: string;
  text: string;
  to: string;
}

export interface MailTransport {
  close?: () => void;
  sendMail: (message: EmailMessage) => Promise<unknown>;
}

export interface SmtpTransportOptions {
  host: string;
  password: string;
  port: number;
  secure: boolean;
  user: string;
}

export function createSmtpTransport({
  host,
  password,
  port,
  secure,
  user,
}: SmtpTransportOptions): MailTransport {
  return nodemailer.createTransport({
    auth: { pass: password, user },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    host,
    pool: true,
    port,
    secure,
    socketTimeout: 10_000,
  });
}
