import * as Haptics from 'expo-haptics';

export type Buzz = 'select' | 'light' | 'medium' | 'heavy' | 'error';

const RUN: Record<Buzz, () => Promise<void>> = {
  select: () => Haptics.selectionAsync(),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

export function buzz(on: boolean, kind: Buzz) {
  if (on) RUN[kind]().catch(() => {});
}
