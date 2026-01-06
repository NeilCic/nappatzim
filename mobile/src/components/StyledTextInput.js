import React, { useRef, useState, useEffect } from 'react';
import { TextInput } from 'react-native';

/**
 * Styled TextInput component with centralized styling
 * Applies dark placeholder color by default
 * Handles selectTextOnFocus behavior - clears selection after user starts typing
 */
export default function StyledTextInput({ 
  placeholderTextColor = "#222222", 
  selectTextOnFocus,
  onChangeText,
  onFocus,
  selection: controlledSelection,
  ...props 
}) {
  const hasSelectedOnThisFocus = useRef(false);
  const [selection, setSelection] = useState(undefined);
  const inputRef = useRef(null);

  // Reset selection state when value changes externally (not from user typing)
  useEffect(() => {
    if (!hasSelectedOnThisFocus.current) {
      setSelection(undefined);
    }
  }, [props.value]);

  const handleFocus = (e) => {
    // If selectTextOnFocus is true and there's a value, select all text
    if (selectTextOnFocus && props.value && props.value.length > 0) {
      // Use setTimeout to ensure the selection happens after focus
      setTimeout(() => {
        setSelection({ start: 0, end: props.value.length });
        hasSelectedOnThisFocus.current = true;
      }, 0);
    } else {
      // Not selecting text, so ensure flag is false
      hasSelectedOnThisFocus.current = false;
    }
    
    // Call original onFocus if provided
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleChangeText = (text) => {
    // Clear selection after user starts typing
    if (hasSelectedOnThisFocus.current) {
      hasSelectedOnThisFocus.current = false;
      const textLength = text.length;
      
      // Use setNativeProps to directly set cursor position
      // This bypasses React's state updates and works immediately
      if (inputRef.current) {
        inputRef.current.setNativeProps({
          selection: { start: textLength, end: textLength }
        });
      }
      
      // Clear our selection state so we stop controlling it
      setSelection(undefined);
    }
    
    // Call original onChangeText if provided
    if (onChangeText) {
      onChangeText(text);
    }
  };

  // Use controlled selection if provided, otherwise use our internal selection
  // Only pass selection prop if it's defined (not undefined)
  const textInputProps = { ...props };
  if (controlledSelection !== undefined) {
    textInputProps.selection = controlledSelection;
  } else if (selection !== undefined) {
    textInputProps.selection = selection;
  }

  return (
    <TextInput
      ref={inputRef}
      placeholderTextColor={placeholderTextColor}
      selectTextOnFocus={false} // We handle this manually
      onChangeText={handleChangeText}
      onFocus={handleFocus}
      {...textInputProps}
    />
  );
}

