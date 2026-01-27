import React from "react";
import { ScrollView, RefreshControl } from "react-native";

/**
 * Reusable ScrollView wrapper with built-in pull-to-refresh.
 *
 * Props:
 * - refreshing: boolean – whether the refresh spinner is active
 * - onRefresh: () => Promise<void> | void – called when user pulls to refresh
 * - children: React.ReactNode – scrollable content
 * - ...rest: any – forwarded to underlying ScrollView
 */
const RefreshableScrollView = React.forwardRef(({
  refreshing = false,
  onRefresh,
  children,
  ...rest
}, ref) => {
  const refreshControl =
    typeof onRefresh === "function"
      ? (
        <RefreshControl
          refreshing={!!refreshing}
          onRefresh={onRefresh}
          tintColor="#007AFF"
        />
      )
      : undefined;

  return (
    <ScrollView
      ref={ref}
      {...rest}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
});

// Set displayName for better debugging in React DevTools and error messages
RefreshableScrollView.displayName = 'RefreshableScrollView';

export default RefreshableScrollView;

