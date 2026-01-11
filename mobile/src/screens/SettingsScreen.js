import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
} from "react-native";
import { useApi } from "../ApiProvider";
import { getCurrentUserId } from "../utils/jwtUtils";
import handleApiCall from "../utils/apiUtils";
import { showError } from "../utils/errorHandler";
import Button from "../components/Button";
import LoadingScreen from "../components/LoadingScreen";
import FormField from "../components/FormField";
import Section from "../components/Section";
import { showSuccessAlert } from "../utils/alert";

export default function SettingsScreen() {
  const [username, setUsername] = useState("");
  const [height, setHeight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      showSuccessAlert("Profile updated successfully");
    } catch (error) {
      showError(error, "Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <Section>
        <FormField
          label="Username"
          description="Choose a username that others can use to find and message you"
          inputProps={{
            placeholder: "Enter username",
            value: username,
            onChangeText: setUsername,
            autoCapitalize: "none",
            autoCorrect: false,
            maxLength: 20,
          }}
        />
      </Section>

      <Section>
        <FormField
          label="Height"
          description="Your height (optional)"
          inputProps={{
            placeholder: "Height (cm)",
            value: height,
            onChangeText: setHeight,
            keyboardType: "numeric",
          }}
        />
      </Section>

      <Button
        title="Save All Changes"
        onPress={saveProfile}
        disabled={saving}
        loading={saving}
        variant="primary"
        size="large"
        style={styles.saveButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  saveButton: {
    marginTop: 8,
  },
  inputMargin: {
    marginTop: 12,
  },
});
