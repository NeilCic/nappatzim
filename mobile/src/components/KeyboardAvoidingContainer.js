import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

/**
 * KeyboardAvoidingView wrapper with sensible defaults
 * 
 * @param {ReactNode} children - Content to wrap
 * @param {string} behavior - 'padding' | 'height' | 'position' (default: auto based on platform)
 * @param {number} keyboardVerticalOffset - Offset for keyboard (default: auto based on platform)
 * @param {object} style - Additional container styles
 */
export default function KeyboardAvoidingContainer({
  children,
  behavior = Platform.OS === 'ios' ? 'padding' : 'height',
  keyboardVerticalOffset = Platform.OS === 'ios' ? 0 : 0,
  style,
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

