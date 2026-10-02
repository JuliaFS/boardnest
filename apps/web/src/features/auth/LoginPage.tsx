import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { getAuthErrorMessage } from './auth-errors';
import { loginSchema, type LoginValues } from './auth-schemas';
import { useAuth } from './AuthProvider';
import { TurnstileWidget } from './TurnstileWidget';

export function LoginPage() {
  const { continueAsGuest, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const handleCaptchaToken = useCallback(
    (token: string | null) => setCaptchaToken(token),
    [],
  );
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmissionError(null);

    try {
      await signIn(values.email, values.password);
      const returnPath = getReturnPath(location.state);
      await navigate(returnPath, { replace: true });
    } catch (error) {
      setSubmissionError(getAuthErrorMessage(error));
    }
  });

  return (
    <AuthShell
      description="Welcome back. Sign in to continue to your projects."
      title="Sign in"
    >
      <form
        className="auth-form"
        onSubmit={(event) => void onSubmit(event)}
        noValidate
      >
        <FormField
          autoComplete="email"
          error={errors.email?.message}
          label="Email"
          type="email"
          {...register('email')}
        />
        <FormField
          autoComplete="current-password"
          error={errors.password?.message}
          label="Password"
          type="password"
          {...register('password')}
        />
        {submissionError ? (
          <p className="form-message error-message" role="alert">
            {submissionError}
          </p>
        ) : null}
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="auth-divider" aria-hidden="true">
        <span>or</span>
      </div>
      <TurnstileWidget
        onTokenChange={handleCaptchaToken}
        resetKey={turnstileResetKey}
      />
      <button
        className="guest-button"
        disabled={isSubmitting || guestLoading || !captchaToken}
        onClick={() => {
          if (!captchaToken) return;
          setSubmissionError(null);
          setGuestLoading(true);
          void continueAsGuest(captchaToken)
            .then(() => navigate('/dashboard', { replace: true }))
            .catch((error: unknown) =>
              setSubmissionError(getAuthErrorMessage(error)),
            )
            .finally(() => {
              setGuestLoading(false);
              setCaptchaToken(null);
              setTurnstileResetKey((current) => current + 1);
            });
        }}
        type="button"
      >
        {guestLoading ? 'Starting demo…' : 'Continue as guest'}
      </button>
      <p className="guest-copy">
        No registration required. Guest accounts are limited to 1 workspace, 1
        project, 20 tasks, 1 invitation, and 10 comments. Task edits and moves
        are unlimited.
      </p>
      <p className="auth-switch">
        New to Boardnest? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}

interface AuthShellProps {
  children: React.ReactNode;
  description: string;
  title: string;
}

export function AuthShell({ children, description, title }: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="brand" to="/">
          Boardnest
        </Link>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
    </main>
  );
}

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | undefined;
  label: string;
}

export function FormField({ error, id, label, ...inputProps }: FormFieldProps) {
  const inputId = id ?? inputProps.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <label className="form-field" htmlFor={inputId}>
      <span>{label}</span>
      <input
        {...inputProps}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        id={inputId}
      />
      {error ? (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function getReturnPath(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string' &&
    state.from.startsWith('/') &&
    !state.from.startsWith('//')
  ) {
    return state.from;
  }

  return '/dashboard';
}
