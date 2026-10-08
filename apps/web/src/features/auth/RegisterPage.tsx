import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { getAuthErrorMessage } from './auth-errors';
import { registerSchema, type RegisterValues } from './auth-schemas';
import { useAuth } from './AuthProvider';
import { AuthShell, FormField } from './LoginPage';
import { TurnstileWidget } from './TurnstileWidget';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
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
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    if (!captchaToken) {
      setSubmissionError('Complete the security check.');
      return;
    }
    setSubmissionError(null);

    try {
      const needsEmailConfirmation = await signUp({
        captchaToken,
        displayName: values.displayName,
        email: values.email,
        password: values.password,
      });

      if (needsEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        await navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      setSubmissionError(getAuthErrorMessage(error));
    } finally {
      setCaptchaToken(null);
      setTurnstileResetKey((current) => current + 1);
    }
  });

  if (confirmationSent) {
    return (
      <AuthShell
        description="We sent you a confirmation link. Open it to activate your account, then sign in."
        title="Check your email"
      >
        <Link className="primary-button button-link" to="/login">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      description="Create your account and start organizing work with your team."
      title="Create account"
    >
      <form
        className="auth-form"
        onSubmit={(event) => void onSubmit(event)}
        noValidate
      >
        <FormField
          autoComplete="name"
          error={errors.displayName?.message}
          label="Display name"
          type="text"
          {...register('displayName')}
        />
        <FormField
          autoComplete="email"
          error={errors.email?.message}
          label="Email"
          type="email"
          {...register('email')}
        />
        <FormField
          autoComplete="new-password"
          error={errors.password?.message}
          label="Password"
          type="password"
          {...register('password')}
        />
        <FormField
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          label="Confirm password"
          type="password"
          {...register('confirmPassword')}
        />
        <TurnstileWidget
          action="registration"
          onTokenChange={handleCaptchaToken}
          resetKey={turnstileResetKey}
        />
        {submissionError ? (
          <p className="form-message error-message" role="alert">
            {submissionError}
          </p>
        ) : null}
        <button
          className="primary-button"
          disabled={isSubmitting || !captchaToken}
          type="submit"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
