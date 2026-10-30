import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { theme } from '@/theme';

type AppScreenProps = {
  children: ReactNode;
  description?: string;
  edges?: readonly Edge[];
  eyebrow?: string;
  scroll?: boolean;
  title: string;
};

export function AppScreen({
  children,
  description,
  edges = ['left', 'right', 'bottom'],
  eyebrow,
  scroll = true,
  title,
}: AppScreenProps) {
  const content = (
    <View style={styles.content}>
      <View style={styles.heading}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={[...edges]} style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: theme.spacing.xl, padding: theme.spacing.lg },
  description: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: theme.typography.bodyLineHeight,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  heading: { gap: theme.spacing.sm },
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { flexGrow: 1 },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.heading,
    fontWeight: '800',
  },
});
