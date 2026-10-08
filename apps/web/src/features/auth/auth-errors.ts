export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Authentication failed. Please try again.';
  }

  const message = error.message.toLowerCase();

  if (
    error instanceof TypeError &&
    (message.includes('fetch') || message.includes('network'))
  ) {
    return 'Cannot reach the API. Make sure the backend is running and try again.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }

  if (message.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  if (message.includes('user already registered')) {
    return 'An account with this email already exists.';
  }

  if (message.includes('anonymous') && message.includes('disabled')) {
    return 'The guest demo is temporarily unavailable.';
  }

  if (message.includes('rate limit')) {
    return 'Too many guest sessions were started. Please try again later.';
  }

  if (message.includes('captcha')) {
    return 'Complete the security check and try again.';
  }

  if (message.includes('password')) {
    return error.message;
  }

  return 'Authentication failed. Please try again.';
}
