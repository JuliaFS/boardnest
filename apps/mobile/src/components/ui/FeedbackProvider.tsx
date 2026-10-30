import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

type FeedbackTone = 'error' | 'info' | 'success';
type FeedbackMessage = { message: string; tone?: FeedbackTone };
type FeedbackContextValue = { showToast: (feedback: FeedbackMessage) => void };

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function showToast(nextFeedback: FeedbackMessage) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFeedback(nextFeedback);
    timerRef.current = setTimeout(() => setFeedback(null), 4_000);
  }

  return (
    <FeedbackContext.Provider value={{ showToast }}>
      <View style={styles.root}>
        {children}
        {feedback ? (
          <View
            accessibilityLiveRegion={
              feedback.tone === 'error' ? 'assertive' : 'polite'
            }
            accessibilityRole="alert"
            style={[styles.toast, styles[feedback.tone ?? 'info']]}
          >
            <Text style={styles.toastText}>{feedback.message}</Text>
          </View>
        ) : null}
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider.');
  }
  return context;
}

const styles = StyleSheet.create({
  error: { borderColor: theme.colors.danger },
  info: { borderColor: theme.colors.primary },
  root: { flex: 1 },
  success: { borderColor: theme.colors.success },
  toast: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: theme.spacing.xxl,
    left: theme.spacing.md,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.md,
  },
  toastText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
