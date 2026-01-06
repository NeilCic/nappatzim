import React from 'react';
import { Modal as RNModal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';

/**
 * Centralized Modal component with overlay and content styling
 * 
 * @param {boolean} visible - Whether modal is visible
 * @param {function} onClose - Function to call when modal should close
 * @param {string} title - Optional modal title
 * @param {string} subtitle - Optional subtitle/description
 * @param {ReactNode} children - Modal content
 * @param {object} style - Additional content container styles
 * @param {object} overlayStyle - Additional overlay styles
 * @param {string} animationType - 'slide' | 'fade' | 'none' (default: 'slide')
 * @param {boolean} dismissOnOverlayPress - Whether to close when overlay is pressed (default: true)
 */
export default function AppModal({
  visible,
  onClose,
  title = null,
  subtitle = null,
  children,
  style,
  overlayStyle,
  animationType = 'slide',
  dismissOnOverlayPress = true,
}) {
  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType={animationType}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={dismissOnOverlayPress ? onClose : undefined}>
        <View style={[styles.overlay, overlayStyle]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.content, style]}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
});

