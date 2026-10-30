import { Icon, type IconName } from '@/components/icons/Icon';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router/js-tabs';

import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionsButton } from '@/components/sections';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { unreadCount } from '@/lib/esports-api';
import { useWaitingInvites } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

const TABS: { name: string; label: 'home' | 'events' | 'matches' | 'ranks' | 'account'; icon: IconName }[] = [
  { name: 'esports', label: 'home', icon: 'home' },
  { name: 'events', label: 'events', icon: 'events' },
  { name: 'matches', label: 'matches', icon: 'matches' },
  { name: 'ranks', label: 'ranks', icon: 'ranks' },
  { name: 'account', label: 'account', icon: 'account' },
];

/**
 * The Esports section (hub tile Esports): five tabs, esports first (M21 §4.3). Every tab has an icon
 * and a label; screens with a header carry the All sections button.
 */
export default function EsportsLayout() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { status } = useAuth();
  // Unread notifications on the Account tab (M08-FR-04); refreshed by notification.created.
  const unread = useQuery({ queryKey: keys.unread, queryFn: unreadCount, enabled: status === 'signed_in' });
  // Plus gym invites waiting for an answer (M24 §4.5): they live behind Account, Gym.
  const waiting = useWaitingInvites();
  const total = (unread.data ?? 0) + waiting;
  const badge = status === 'signed_in' && total ? (total > 99 ? '99+' : total) : undefined;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textSecondary,
        // Room for Bangla letters, which sit taller than Latin ones, plus the phone's gesture bar.
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.line, height: 72 + insets.bottom, paddingTop: 8, paddingBottom: 10 + insets.bottom },
        tabBarLabelStyle: withTypeface({ fontSize: 12, lineHeight: 18, fontWeight: '600' }, i18n.language),
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: withTypeface({ fontWeight: '700' }, i18n.language),
        headerRight: () => <SectionsButton />,
        // A short crossfade between tabs (none with reduce motion).
        animation: reduce ? 'none' : 'fade',
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`tabs.${tab.label}`),
            // Home has no header; Events and Ranks have their own stacks (list, then a page).
            headerShown: !['esports', 'events', 'ranks'].includes(tab.name),
            tabBarIcon: ({ color, size, focused }) => <Icon name={tab.icon} color={color} size={size} active={focused} />,
            tabBarBadge: tab.name === 'account' ? badge : undefined,
            tabBarBadgeStyle: { backgroundColor: theme.brand, color: theme.onBrand },
          }}
        />
      ))}
    </Tabs>
  );
}
