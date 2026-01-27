import React from 'react';
import { Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { BORDER_RADIUS } from '../shared/designSystem';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import { TouchableOpacity } from 'react-native';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * 
 * @param {string} title - Button text (ignored if children provided)
 * @param {ReactNode} children - Custom content (overrides title)
 * @param {function} onPress - Press handler
 * @param {string} variant - 'primary' | 'secondary' | 'outline' | 'text' | 'gradient'
 * @param {boolean} disabled - Disabled state
 * @param {boolean} loading - Shows loading spinner
 * @param {object} style - Additional styles for container
 * @param {object} textStyle - Additional styles for text
 * @param {string} size - 'small' | 'medium' | 'large'
 */
export default function Button({
  title,
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  size = 'medium',
}) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    if (!isDisabled) {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
      opacity.value = withTiming(0.8, { duration: 100 });
    }
  };

  const handlePressOut = () => {
    if (!isDisabled) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 100 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const buttonStyles = [
    styles.button,
    styles[`button_${size}`],
    isDisabled && styles.buttonDisabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    isDisabled && styles.textDisabled,
    textStyle,
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' || variant === 'gradient' ? '#FFFFFF' : '#007AFF'} 
        />
      );
    }
    if (children) {
      return children;
    }
    return <Text style={textStyles}>{title}</Text>;
  };

  // Gradient button
  if (variant === 'gradient') {
    const gradientColors = isDisabled 
      ? ['#B0B0B0', '#D0D0D0', '#B0B0B0'] // Gray gradient when disabled
      : ['#007AFF', '#5AC8FA', '#007AFF'];
    
    return (
      <AnimatedTouchable
        style={[buttonStyles, animatedStyle, isDisabled && styles.gradientDisabled]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <LinearGradient
            colors={isDisabled 
              ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'] 
              : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradientOverlay}
          >
            {renderContent()}
          </LinearGradient>
        </LinearGradient>
      </AnimatedTouchable>
    );
  }

  // Primary button with 3D effect
  if (variant === 'primary' && !isDisabled) {
    return (
      <AnimatedTouchable
        style={[buttonStyles, animatedStyle]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
      >
        <LinearGradient
          colors={['#007AFF', '#0051D5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.gradient, styles.gradientAbsolute]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 0.5 }}
            style={styles.gradientOverlay}
          >
            {renderContent()}
          </LinearGradient>
        </LinearGradient>
      </AnimatedTouchable>
    );
  }

  // Regular button variants
  return (
    <AnimatedTouchable
      style={[
        buttonStyles,
        styles[`button_${variant}`],
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {renderContent()}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    alignSelf: 'stretch', // Allow button to expand to container width
  },
  
  // Variants
  button_primary: {
    backgroundColor: '#007AFF',
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  button_secondary: {
    backgroundColor: '#F0F0F0',
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  button_text: {
    backgroundColor: 'transparent',
  },
  button_gradient: {
    // Handled by LinearGradient
  },
  
  // Sizes
  button_small: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 40,
    borderRadius: BORDER_RADIUS.md,
  },
  button_medium: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.lg,
  },
  button_large: {
    paddingVertical: 18,
    paddingHorizontal: 36,
    minHeight: 56,
    borderRadius: BORDER_RADIUS.lg,
  },
  
  // States
  buttonDisabled: {
    opacity: 0.5,
  },
  gradientDisabled: {
    opacity: 0.8, // Less opacity reduction for gradient buttons
  },
  
  // Gradient styles
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  gradientOverlay: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.lg,
  },
  gradientAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: undefined, // Override width: '100%' when using absolute positioning
    height: undefined, // Override height: '100%' when using absolute positioning
  },
  
  // Text styles
  text: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: '#333333',
  },
  text_outline: {
    color: '#007AFF',
  },
  text_text: {
    color: '#007AFF',
  },
  text_gradient: {
    color: '#FFFFFF',
  },
  text_small: {
    fontSize: 14,
  },
  text_medium: {
    fontSize: 16,
  },
  text_large: {
    fontSize: 20,
  },
  textDisabled: {
    opacity: 0.7,
  },
});
