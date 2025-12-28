import React from 'react';
import { TextInput } from 'react-native';

/**
 * Styled TextInput component with centralized styling
 * Applies dark placeholder color by default
 */
export default function StyledTextInput({ placeholderTextColor = "#222222", ...props }) {
  return <TextInput placeholderTextColor={placeholderTextColor} {...props} />;
}

