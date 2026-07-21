/**
 * Design-system token mirrors.
 * Foundations: color / typography / spacing / surface / control / interaction (5.2.1).
 * Layers: breakpoints / content width / z-index / motion (5.2.2).
 * Migration: `docs/design-system/token-migration-plan.md`.
 */

export const colorTokens = {
  page: "var(--portal-page)",
  surface: "var(--portal-surface)",
  surfaceSecondary: "var(--portal-surface-secondary)",

  text: "var(--portal-text)",
  textMuted: "var(--portal-text-muted)",
  textSubtle: "var(--portal-text-subtle)",
  textInverse: "var(--portal-text-inverse)",

  border: "var(--portal-border)",
  borderStrong: "var(--portal-border-strong)",

  primary: "var(--portal-primary)",
  primaryHover: "var(--portal-primary-hover)",
  primarySoft: "var(--portal-primary-soft)",
  primaryOn: "var(--portal-primary-on)",
  primaryGradientFrom: "var(--portal-primary-gradient-from)",
  primaryGradientTo: "var(--portal-primary-gradient-to)",

  success: "var(--portal-success)",
  successSoft: "var(--portal-success-soft)",
  warning: "var(--portal-warning)",
  warningSoft: "var(--portal-warning-soft)",
  danger: "var(--portal-danger)",
  dangerSoft: "var(--portal-danger-soft)",
  dangerHover: "var(--portal-danger-hover)",

  focusRing: "var(--portal-focus-ring)",
} as const;

export const typographyTokens = {
  fontSans: "var(--portal-font-sans)",
  fontMono: "var(--portal-font-mono)",

  sizeDisplay: "var(--portal-font-size-display)",
  sizePage: "var(--portal-font-size-page)",
  sizeEntity: "var(--portal-font-size-entity)",
  sizeSection: "var(--portal-font-size-section)",
  sizeSectionSm: "var(--portal-font-size-section-sm)",
  sizeBody: "var(--portal-font-size-body)",
  sizeDense: "var(--portal-font-size-dense)",
  sizeMeta: "var(--portal-font-size-meta)",
  sizeCaption: "var(--portal-font-size-caption)",

  leadingTight: "var(--portal-leading-tight)",
  leadingSnug: "var(--portal-leading-snug)",
  leadingNormal: "var(--portal-leading-normal)",
  leadingRelaxed: "var(--portal-leading-relaxed)",

  weightRegular: "var(--portal-font-weight-regular)",
  weightMedium: "var(--portal-font-weight-medium)",
  weightSemibold: "var(--portal-font-weight-semibold)",
  weightBold: "var(--portal-font-weight-bold)",
  weightExtrabold: "var(--portal-font-weight-extrabold)",

  trackingTight: "var(--portal-tracking-tight)",
  trackingNormal: "var(--portal-tracking-normal)",
} as const;

export const spacingTokens = {
  space0: "var(--portal-space-0)",
  space1: "var(--portal-space-1)",
  space2: "var(--portal-space-2)",
  space3: "var(--portal-space-3)",
  space4: "var(--portal-space-4)",
  space5: "var(--portal-space-5)",
  space6: "var(--portal-space-6)",
  space8: "var(--portal-space-8)",
  space10: "var(--portal-space-10)",
  space12: "var(--portal-space-12)",
} as const;

export const borderTokens = {
  width: "var(--portal-border-width)",
  widthStrong: "var(--portal-border-width-strong)",
  color: "var(--portal-border)",
  colorStrong: "var(--portal-border-strong)",
} as const;

export const radiusTokens = {
  none: "var(--portal-radius-none)",
  sm: "var(--portal-radius-sm)",
  md: "var(--portal-radius-md)",
  lg: "var(--portal-radius-lg)",
  xl: "var(--portal-radius-xl)",
  full: "var(--portal-radius-full)",
} as const;

export const shadowTokens = {
  sm: "var(--portal-shadow-sm)",
  card: "var(--portal-shadow-card)",
  overlay: "var(--portal-shadow-overlay)",
  modal: "var(--portal-shadow-modal)",
} as const;

export const controlSizeTokens = {
  controlCompact: "var(--portal-control-compact)",
  controlDefault: "var(--portal-control-default)",
  controlSpacious: "var(--portal-control-spacious)",
  controlIcon: "var(--portal-control-icon)",
  iconSm: "var(--portal-icon-sm)",
  iconMd: "var(--portal-icon-md)",
  iconLg: "var(--portal-icon-lg)",
  iconXl: "var(--portal-icon-xl)",
  avatarSm: "var(--portal-avatar-sm)",
  avatarMd: "var(--portal-avatar-md)",
  avatarLg: "var(--portal-avatar-lg)",
  shellTopbarSm: "var(--portal-shell-topbar-sm)",
  shellTopbar: "var(--portal-shell-topbar)",
  shellSidebarExpanded: "var(--portal-shell-sidebar-expanded)",
  shellSidebarCompact: "var(--portal-shell-sidebar-compact)",
  contentNarrow: "var(--portal-content-narrow)",
  contentDefault: "var(--portal-content-default)",
  contentMax: "var(--portal-content-max)",
} as const;

export const interactionTokens = {
  hoverBg: "var(--portal-state-hover-bg)",
  pressedBg: "var(--portal-state-pressed-bg)",
  selectedBg: "var(--portal-state-selected-bg)",
  selectedFg: "var(--portal-state-selected-fg)",
  selectedBorder: "var(--portal-state-selected-border)",
  disabledOpacity: "var(--portal-state-disabled-opacity)",
  disabledBg: "var(--portal-state-disabled-bg)",
  disabledFg: "var(--portal-state-disabled-fg)",
  disabledBorder: "var(--portal-state-disabled-border)",
  focusRing: "var(--portal-focus-ring)",
  focusRingWidth: "var(--portal-focus-ring-width)",
  focusRingOffset: "var(--portal-focus-ring-offset)",
  dangerHover: "var(--portal-danger-hover)",
} as const;

export const breakpointTokens = {
  narrowMobileMax: "var(--portal-bp-narrow-mobile-max)",
  mobileMax: "var(--portal-bp-mobile-max)",
  tabletMin: "var(--portal-bp-tablet-min)",
  laptopMin: "var(--portal-bp-laptop-min)",
  desktopMin: "var(--portal-bp-desktop-min)",
  wideMin: "var(--portal-bp-wide-min)",
} as const;

export const contentWidthTokens = {
  narrow: "var(--portal-content-narrow)",
  default: "var(--portal-content-default)",
  max: "var(--portal-content-max)",
  gridMinSm: "var(--portal-grid-min-sm)",
  gridMinMd: "var(--portal-grid-min-md)",
  gridMinLg: "var(--portal-grid-min-lg)",
} as const;

export const zIndexTokens = {
  base: "var(--portal-z-base)",
  raised: "var(--portal-z-raised)",
  sticky: "var(--portal-z-sticky)",
  dropdown: "var(--portal-z-dropdown)",
  shell: "var(--portal-z-shell)",
  shellFloat: "var(--portal-z-shell-float)",
  popover: "var(--portal-z-popover)",
  search: "var(--portal-z-search)",
  modal: "var(--portal-z-modal)",
  modal1: "var(--portal-z-modal-1)",
  modal2: "var(--portal-z-modal-2)",
  modal3: "var(--portal-z-modal-3)",
  modal4: "var(--portal-z-modal-4)",
  toast: "var(--portal-z-toast)",
} as const;

export const motionTokens = {
  fast: "var(--portal-motion-fast)",
  normal: "var(--portal-motion-normal)",
  slow: "var(--portal-motion-slow)",
  ease: "var(--portal-motion-ease)",
  easeEmphasized: "var(--portal-motion-ease-emphasized)",
} as const;

/** @deprecated Prefer named *Tokens exports. */
export const uiTokens = {
  color: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  border: borderTokens,
  radius: radiusTokens,
  shadow: shadowTokens,
  control: controlSizeTokens,
  interaction: interactionTokens,
  breakpoint: breakpointTokens,
  contentWidth: contentWidthTokens,
  zIndex: zIndexTokens,
  motion: motionTokens,
} as const;
