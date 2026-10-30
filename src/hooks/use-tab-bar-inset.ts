import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The floating tab bar: its height and the gap under it (plus the phone's gesture bar). */
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 8;

/**
 * Bottom padding a scrolling tab screen needs so its last item clears the floating tab bar.
 * Zero outside a tab navigator (a pushed stack screen), so shared components can always use it.
 */
export function useTabBarInset(): number {
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const insets = useSafeAreaInsets();
  return inTabs ? TAB_BAR_HEIGHT + TAB_BAR_GAP + insets.bottom + 8 : 0;
}
