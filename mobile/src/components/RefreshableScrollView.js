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
export default function RefreshableScrollView({
  refreshing = false,
  onRefresh,
  children,
  ...rest
}) {
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
      {...rest}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

