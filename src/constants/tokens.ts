// Generated from kriraghor-frontend packages/tokens/src/tokens.ts. Do not edit here.
/**
 * Kriraghor design tokens for React Native (kriraghor-mobile-app). The same values as tokens.css;
 * tokens.test.ts fails when the two drift. Copy into the app with `npm run tokens:copy -- <app path>`.
 */
export const palette = {
  light: {
    bg: "#f3f5f3",
    surface: "#ffffff",
    surface2: "#ebefec",
    ink: "#111a15",
    muted: "#56635b",
    line: "#dce2dd",
    lineStrong: "#87938b",
    brand: "#0b7a4b",
    brandHover: "#09683f",
    brandSoft: "#e2f1e8",
    brandText: "#075533",
    onBrand: "#ffffff",
    band: "#0a1a12",
    bandText: "#f1f4f2",
    prize: "#f2a33a",
    prizeInk: "#10231a",
    prizeSoft: "#fdefd6",
    prizeText: "#8f5115",
    live: "#e5484d",
    danger: "#b42318",
    dangerSoft: "#fdecea",
    info: "#2c5aa8",
    infoSoft: "#e8eefa",
    warning: "#b46714",
    warningSoft: "#fdf3e3",
  },
  dark: {
    bg: "#0c120f",
    surface: "#141c18",
    surface2: "#1b2520",
    ink: "#e8ece9",
    muted: "#a2afa7",
    line: "#26312b",
    lineStrong: "#5d6b63",
    brand: "#19995f",
    brandHover: "#22ad6c",
    brandSoft: "#143a28",
    brandText: "#8fd8b2",
    onBrand: "#ffffff",
    band: "#07120d",
    bandText: "#f1f4f2",
    prize: "#f2a33a",
    prizeInk: "#10231a",
    prizeSoft: "#3a2a12",
    prizeText: "#f8c574",
    live: "#e5484d",
    danger: "#f97066",
    dangerSoft: "#3b1715",
    info: "#84adff",
    infoSoft: "#172442",
    warning: "#f5b052",
    warningSoft: "#33250f",
  },
} as const;

export type ColorName = keyof (typeof palette)["light"];

/** The shape rule: controls 12, cards/sheets/dialogs 20, chips/badges/avatars full. */
export const radius = { control: 12, card: 20, pill: 9999 } as const;

/** A 4px spacing scale. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** The type scale (px). */
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48 } as const;

export const duration = { fast: 150, base: 220, slow: 320 } as const;

/** Font families as loaded by @expo-google-fonts (the web loads the same fonts with next/font). */
export const fonts = {
  display: "AnekBangla_700Bold",
  displaySemi: "AnekBangla_600SemiBold",
  sans: "Geist_400Regular",
  sansMedium: "Geist_500Medium",
  sansSemi: "Geist_600SemiBold",
  sansBold: "Geist_700Bold",
  bangla: "NotoSansBengali_400Regular",
  banglaBold: "NotoSansBengali_700Bold",
  mono: "GeistMono_500Medium",
} as const;

/** Elevation for React Native (iOS shadow + Android elevation), green-grey tinted. */
export const elevation = {
  sm: { shadowColor: "#0a1a12", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: "#0a1a12", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  lg: { shadowColor: "#0a1a12", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
} as const;
