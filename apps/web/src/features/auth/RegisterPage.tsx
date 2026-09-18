import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { getAuthErrorMessage } from './auth-errors';
import { registerSchema, type RegisterValues } from './auth-schemas';
import { useAuth } from './AuthProvider';
import { AuthShell, FormField } from './LoginPage';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmissionError(null);

    try {
      const needsEmailConfirmation = await signUp({
        email: values.email,
        options: { data: { display_name: values.displayName } },
        password: values.password,
      });

      if (needsEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        await navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      setSubmissionError(getAuthErrorMessage(error));
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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
