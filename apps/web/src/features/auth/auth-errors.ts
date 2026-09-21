export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Authentication failed. Please try again.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (message.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  if (message.includes('user already registered')) {
    return 'An account with this email already exists.';
  }

  if (message.includes('password')) {
    return error.message;
  }

  return 'Authentication failed. Please try again.';
}
