import React, { useEffect } from 'react';
import { Pressable as RNPressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';


const AnimatedPressable = ({
  onPress,
  children,
  scaleTo = 0.95,
  visible = true,
  style,
  pressableStyle,
  springConfig = { damping: 15, stiffness: 300 },
  disabled = false,
  ...rest
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    // Animate opacity when visible prop changes
    if (visible && opacity.value !== 1) {
      opacity.value = withTiming(1, { duration: 200 });
    } else if (!visible && opacity.value !== 0) {
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, opacity]);

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(scaleTo, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, style]} pointerEvents={visible && !disabled ? 'auto' : 'none'}>
      <RNPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || !visible}
        style={pressableStyle}
        {...rest}
      >
        {children}
      </RNPressable>
    </Animated.View>
  );
};

export default AnimatedPressable;
