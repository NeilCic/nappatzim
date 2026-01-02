import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Updates from "expo-updates";
import { useApi } from "../ApiProvider";
import { getCurrentUserId } from "../utils/jwtUtils";
import handleApiCall from "../utils/apiUtils";
import { showError } from "../utils/errorHandler";
import StyledTextInput from "../components/StyledTextInput";

export default function PreferencesScreen() {
  const [username, setUsername] = useState("");
  const [height, setHeight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const { api } = useApi();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const data = await handleApiCall(
      () => api.get(`/auth/me`),
      setLoading,
      "Error fetching user info"
    );

    if (data) {
      setUsername(data.username || "");
      setHeight(data.height ? String(data.height) : "");
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updateData = {
        username: username.trim() || undefined,
        height: height.trim() === "" ? null : parseFloat(height.trim()),
      };

      const res = await api.patch("/auth/profile", updateData);

      if (res.data) {
        setUsername(res.data.username || "");
        setHeight(res.data.height ? String(res.data.height) : "");
      }
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      showError(error, "Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const checkForUpdates = async () => {
    if (!Updates.isEnabled) {
      Alert.alert("Updates", "Updates are not enabled in development mode");
      return;
    }

    setCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        Alert.alert(
          "Update Available",
          "A new update is available. The app will reload to apply it.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Update Now",
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        Alert.alert("Updates", "You're already on the latest version!");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to check for updates: " + error.message);
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.description}>
          Choose a username that others can use to find and message you
        </Text>
        <StyledTextInput
          style={styles.input}
          placeholder="Enter username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Height</Text>
        <Text style={styles.description}>
          Your height (optional)
        </Text>
        <StyledTextInput
          style={styles.input}
          placeholder="Height (cm)"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveProfile}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.saveButtonText}>Save All Changes</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.updateButton, checkingUpdate && styles.updateButtonDisabled]}
        onPress={checkForUpdates}
        disabled={checkingUpdate}
      >
        {checkingUpdate ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Text style={styles.updateButtonText}>Check for App Updates</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#ccc",
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  inputMargin: {
    marginTop: 12,
  },
  updateButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

