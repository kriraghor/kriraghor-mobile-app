import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { unreadCount } from '@/lib/esports-api';
import { keys } from '@/lib/use-realtime';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const TABS: { name: string; label: 'home' | 'events' | 'matches' | 'ranks' | 'account'; icon: IconName }[] = [
  { name: 'index', label: 'home', icon: 'home-variant' },
  { name: 'events', label: 'events', icon: 'trophy' },
  { name: 'matches', label: 'matches', icon: 'sword-cross' },
  { name: 'ranks', label: 'ranks', icon: 'podium' },
  { name: 'account', label: 'account', icon: 'account-circle' },
];

/** Five tabs, esports first (M21 §4.3). Every tab has an icon and a label. */
export default function TabsLayout() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  // Unread notifications on the Account tab (M08-FR-04); refreshed by notification.created.
  const unread = useQuery({ queryKey: keys.unread, queryFn: unreadCount, enabled: status === 'signed_in' });
  const badge = status === 'signed_in' && unread.data ? (unread.data > 99 ? '99+' : unread.data) : undefined;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textSecondary,
        // Room for Bangla letters, which sit taller than Latin ones, plus the phone's gesture bar.
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.line, height: 64 + insets.bottom, paddingTop: 6, paddingBottom: 8 + insets.bottom },
        tabBarLabelStyle: withTypeface({ fontSize: 12, lineHeight: 18, fontWeight: '600' }, i18n.language),
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: withTypeface({ fontWeight: '700' }, i18n.language),
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(`tabs.${tab.label}`),
            // Home has no header; Events has its own stack (list, then detail).
            headerShown: tab.name !== 'index' && tab.name !== 'events',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={tab.icon} color={color} size={size} />,
            tabBarBadge: tab.name === 'account' ? badge : undefined,
            tabBarBadgeStyle: { backgroundColor: theme.brand, color: theme.onBrand },
          }}
        />
      ))}
    </Tabs>
  );
}
