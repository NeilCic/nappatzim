import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Empty state component for displaying "no data" messages
 * 
 * @param {string} message - Main empty state message
 * @param {string} subtext - Optional secondary message
 * @param {object} style - Additional container styles
 */
export default function EmptyState({ 
  message, 
  subtext = null,
  style 
}) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.message}>{message}</Text>
      {subtext && <Text style={styles.subtext}>{subtext}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

