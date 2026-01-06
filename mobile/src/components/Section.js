import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Section container component with label and description
 * 
 * @param {string} label - Section label/title
 * @param {string} description - Optional description text
 * @param {ReactNode} children - Section content
 * @param {object} style - Additional container styles
 */
export default function Section({
  label,
  description = null,
  children,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      {description && <Text style={styles.description}>{description}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
});

