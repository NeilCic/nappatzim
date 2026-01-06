import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Inline spinner component for loading states within existing content
 * 
 * @param {string} size - 'small' | 'large' (default: 'small')
 * @param {string} color - Spinner color (default: '#007AFF')
 * @param {object} style - Additional container styles
 */
export default function Spinner({ 
  size = 'small', 
  color = '#007AFF',
  style 
}) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Minimal container - just centers the spinner
    alignItems: 'center',
    justifyContent: 'center',
  },
});

