import React from 'react';
import { TouchableOpacity } from 'react-native';

/**
 * Centralized Pressable component wrapper
 * Use this instead of TouchableOpacity directly for consistency
 * 
 * @param {ReactNode} children - Content to make pressable
 * @param {function} onPress - Press handler
 * @param {boolean} disabled - Disabled state
 * @param {object} style - Additional styles
 */
export default function Pressable({
  children,
  onPress,
  disabled = false,
  style,
}) {
  return (
    <TouchableOpacity
      style={style}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
}

