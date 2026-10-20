/**
 * English texts. The Bangla file (bn.ts) must have exactly the same keys: its type is derived from
 * this one, so a missing or extra key fails `npm run typecheck`, and a test checks the values.
 * Names people see (kriraghor-docs 04 §0): Venues, Events, Showcases.
 */
export const en = {
  common: {
    appName: 'Kriraghor',
    signIn: 'Sign in',
    signOut: 'Sign out',
    loading: 'Loading',
    retry: 'Try again',
    offline: "Can't reach Kriraghor. Check your connection.",
    somethingWrong: 'Something went wrong. Try again.',
    comingSoon: 'Coming in the next update.',
  },
  tabs: {
    home: 'Home',
    events: 'Events',
    matches: 'Matches',
    ranks: 'Ranks',
    account: 'Account',
  },
  home: {
    heroTitle: 'Play PUBG Mobile and Free Fire.',
    heroPrize: 'Win real prizes.',
    heroSub: 'Events, venues and gear in one account.',
    myAccount: 'My account',
  },
  events: {
    title: 'Events',
    empty: 'No events open right now. New ones appear here first.',
  },
  matches: {
    title: 'My matches',
    signedOut: 'Sign in to see your matches, check in and get the room ID.',
  },
  ranks: {
    title: 'Ranks',
    empty: 'Leaderboards appear after the first finished event.',
  },
  signIn: {
    title: 'Sign in to Kriraghor',
    sub: 'One account for the app, kriraghor.com and esports.',
    phone: 'Mobile number',
    sendCode: 'Send code',
    codeSent: 'We sent a code. It expires in 5 minutes.',
    code: '6-digit code',
    verify: 'Verify and continue',
    name: 'Your name',
    createAccount: 'Create my account',
  },
  account: {
    title: 'Account',
    signedOut: 'You are not signed in.',
    sameSession: 'This sign-in also works on kriraghor.com and esports.',
    phone: 'Phone',
    email: 'Email',
    roles: 'Roles',
    language: 'Language',
    notifications: 'Notifications',
    notificationsHelp: 'Room IDs, check-in and results reach this phone once notifications are on.',
    enableNotifications: 'Turn on notifications',
    pushRegistered: 'This phone gets notifications.',
    pushDenied: 'Notifications are turned off in your phone settings.',
    pushUnavailable: 'Notifications need a real phone and a store or development build.',
  },
} as const;

/** The shape both languages share: every leaf a string. */
type Leaves<T> = { [K in keyof T]: T[K] extends string ? string : Leaves<T[K]> };
export type Messages = Leaves<typeof en>;
