import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

/**
 * Centralized loading screen component
 * 
 * @param {string} message - Optional loading message (default: null, shows spinner only)
 * @param {string} color - Spinner color (default: '#007AFF')
 * @param {string} size - Spinner size: 'small' | 'large' (default: 'large')
 * @param {object} style - Additional container styles
 */
export default function LoadingScreen({ 
  message = null, 
  color = '#007AFF', 
  size = 'large',
  style 
}) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

