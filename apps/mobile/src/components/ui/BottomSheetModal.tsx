import { useRef, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MIN_TOUCH_TARGET, theme } from '@/theme';

type BottomSheetModalProps = {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  title: string;
  visible: boolean;
};

export function BottomSheetModal({
  children,
  description,
  onClose,
  title,
  visible,
}: BottomSheetModalProps) {
  const titleRef = useRef<ComponentRef<typeof Text>>(null);

  function focusTitle() {
    const titleNode = findNodeHandle(titleRef.current);
    if (titleNode) AccessibilityInfo.setAccessibilityFocus(titleNode);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={focusTitle}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close dialog"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text
                accessibilityRole="header"
                accessible
                ref={titleRef}
                style={styles.title}
              >
                {title}
              </Text>
              {description ? (
                <Text style={styles.description}>{description}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Close dialog"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeLabel}>×</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: { color: theme.colors.text, fontSize: 30, lineHeight: 32 },
  description: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  handle: {
    width: 48,
    height: 5,
    alignSelf: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
  },
  header: { flexDirection: 'row', gap: theme.spacing.md },
  heading: { flex: 1, gap: theme.spacing.xs },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    gap: theme.spacing.lg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  title: { color: theme.colors.text, fontSize: 22, fontWeight: '800' },
});
