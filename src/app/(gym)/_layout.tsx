import { Icon, type IconName } from '@/components/icons/Icon';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router/js-tabs';

import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';
import { SectionsButton } from '@/components/sections';
import { GlassTabBar } from '@/components/tab-bar';
import { SectionScene } from '@/components/transition';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { unreadCount } from '@/lib/esports-api';
import { useWaitingInvites } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

type Label = 'home' | 'today' | 'checkin' | 'passes' | 'account';
const TABS: { name: string; label: Label; icon: IconName }[] = [
  { name: 'gym/index', label: 'home', icon: 'gym' },
  { name: 'gym/today', label: 'today', icon: 'today' },
  { name: 'gym/checkin', label: 'checkin', icon: 'checkin' },
  { name: 'gym/passes', label: 'passes', icon: 'passes' },
  { name: 'gym/account', label: 'account', icon: 'account' },
];

/**
 * The Gym section (hub tile Gym, M24 §4.5 members only): My gyms, Today, Check-in, Passes, Account.
 * The tab screens keep their /gym/... paths, so links and notifications open them directly; the
 * detail screens (a membership, its attendance, a plan, requests, subscriptions) are stack screens
 * pushed on top. Every tab header carries the All sections button.
 */
export default function GymLayout() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const reduce = useReducedMotion();
  const { status } = useAuth();
  const unread = useQuery({ queryKey: keys.unread, queryFn: unreadCount, enabled: status === 'signed_in' });
  const waiting = useWaitingInvites();
  const badge = (n: number) => (status === 'signed_in' && n ? (n > 99 ? '99+' : n) : undefined);
  return (
    <SectionScene>
    <Tabs
      // The floating glass bar shared by both sections (components/tab-bar.tsx).
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: withTypeface({ fontSize: 18, fontWeight: '700' }, i18n.language),
        headerShadowVisible: false,
        headerRight: () => <SectionsButton />,
        // A short crossfade between tabs (none with reduce motion).
        animation: reduce ? 'none' : 'fade',
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            // A guest's first tab is the gym directory (Gyms); a member's is My gyms.
            title: tab.label === 'home' && status !== 'signed_in' ? t('gymDir.tab') : t(`gymTabs.${tab.label}`),
            tabBarIcon: ({ color, size, focused }) => <Icon name={tab.icon} color={color} size={size} active={focused} />,
            // Invites waiting on My gyms (where they are answered); unread notifications on Account.
            tabBarBadge: tab.label === 'home' ? badge(waiting) : tab.label === 'account' ? badge(unread.data ?? 0) : undefined,
          }}
        />
      ))}
    </Tabs>
    </SectionScene>
  );
}
