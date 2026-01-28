import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import StyledTextInput from './StyledTextInput';

/**
 * Form field component with label, description, input, and error handling
 * 
 * @param {string} label - Optional label text
 * @param {string} description - Optional description text below label
 * @param {string} error - Optional error message to display
 * @param {object} inputProps - Props to pass to StyledTextInput
 * @param {object} style - Additional container styles
 * @param {object} inputStyle - Additional input styles
 */
export default function FormField({
  label,
  description,
  error,
  inputProps = {},
  style,
  inputStyle,
}) {
  const hasError = !!error;
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    if (inputProps.onFocus) {
      inputProps.onFocus(e);
    }
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (inputProps.onBlur) {
      inputProps.onBlur(e);
    }
  };

  const mergedInputProps = {
    ...inputProps,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
      <StyledTextInput
        {...mergedInputProps}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          inputStyle,
        ]}
      />
      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
  },
  inputFocused: {
    borderColor: '#007AFF',
  },
  inputError: {
    borderColor: '#ff3b30',
    borderWidth: 2,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: -4,
    marginLeft: 4,
  },
});

