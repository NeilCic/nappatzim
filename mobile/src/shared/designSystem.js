import { Platform } from 'react-native';

/**
 * Design System Constants
 * Standardized values for consistent UI across the app
 */

// Border Radius Scale
export const BORDER_RADIUS = {
  sm: 4,   // Small elements (badges, chips)
  md: 8,   // Medium elements (inputs, small cards)
  lg: 12,  // Large elements (cards, buttons)
  xl: 16,  // Extra large (modals, large cards)
  full: 999, // Fully rounded (pills, circular buttons)
};

// Shadow Presets
export const SHADOWS = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
  }),
  xl: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
    },
    android: {
      elevation: 12,
    },
  }),
};

// Card Shadow (for elevated cards)
export const CARD_SHADOW = SHADOWS.lg;

// Button Shadow (for primary/important buttons)
export const BUTTON_SHADOW = SHADOWS.md;
