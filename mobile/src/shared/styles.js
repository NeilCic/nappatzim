import { StyleSheet } from 'react-native';

/**
 * Shared styles for common UI components
 */

// Common input styles
export const inputStyles = StyleSheet.create({
  default: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  small: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  error: {
    borderColor: "#ff3b30",
    borderWidth: 2,
  },
});

// Common colors
export const colors = {
  placeholder: "#222222",
  error: "#ff3b30",
  primary: "#007AFF",
  border: "#ddd",
  borderLight: "#e0e0e0",
  background: "#f5f5f5",
  text: "#333",
  textSecondary: "#666",
};

