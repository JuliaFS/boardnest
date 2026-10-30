import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

type FoundationScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: readonly string[];
  children?: ReactNode;
};

export function FoundationScreen({
  eyebrow,
  title,
  description,
  items,
  children,
}: FoundationScreenProps) {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark} accessibilityElementsHidden>
            <Text style={styles.brandMarkText}>B</Text>
          </View>
          <Text style={styles.brand}>Boardnest</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        <View accessibilityLabel="Planned functionality" style={styles.card}>
          {items.map((item) => (
            <View key={item} style={styles.item}>
              <View style={styles.itemMarker} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.xl,
    padding: theme.spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  brandMarkText: {
    color: theme.colors.primaryContrast,
    fontSize: 18,
    fontWeight: '800',
  },
  brand: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  hero: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
  },
  description: {
    maxWidth: 560,
    color: theme.colors.textMuted,
    fontSize: 17,
    lineHeight: 26,
  },
  card: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  itemMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  itemText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
