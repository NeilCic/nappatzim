import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ExerciseAdvancedModal({
  visible,
  exerciseName,
  initialSets,
  onClose,
  onSave,
  units,
}) {
  const [localSets, setLocalSets] = useState(initialSets || []);

  useEffect(() => {
    if (visible) {
      setLocalSets(initialSets || []);
    }
  }, [visible, initialSets]);

  const handleSave = () => {
    const detailed = (localSets || []).map((s, i) => ({
      order: i + 1,
      value: Number(s.value) || 0,
      reps: Number(s.reps) || 0,
      restMinutes: Number(s.restMinutes) || 0,
    }));
    onSave?.(detailed);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
        <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
          Advanced Setup for {exerciseName}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
            paddingVertical: 10,
            paddingHorizontal: 8,
            backgroundColor: "rgba(0, 122, 255, 0.08)",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "rgba(0, 122, 255, 0.2)",
            borderLeftWidth: 3,
            borderLeftColor: "rgba(0, 122, 255, 0.3)",
          }}
        >
          <Text
            style={{
              width: 60,
              fontWeight: "600",
              textAlign: "left",
              color: "rgba(0, 122, 255, 0.8)",
              fontSize: 14,
              paddingLeft: 0,
            }}
          >
            Set
          </Text>
          <Text
            style={{
              flex: 1,
              marginRight: 8,
              fontWeight: "600",
              textAlign: "center",
              color: "rgba(0, 122, 255, 0.8)",
              fontSize: 14,
              paddingRight: 20,
            }}
          >
            Reps
          </Text>
          <Text
            style={{
              flex: 1,
              marginRight: 8,
              fontWeight: "600",
              textAlign: "center",
              color: "rgba(0, 122, 255, 0.8)",
              fontSize: 14,
            }}
          >
            {units}
          </Text>
          <Text
            style={{
              flex: 1,
              fontWeight: "600",
              textAlign: "center",
              color: "rgba(0, 122, 255, 0.8)",
              fontSize: 14,
            }}
          >
            Rest
          </Text>
        </View>

        <FlatList
          data={localSets}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item, index }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ width: 60, fontWeight: "600", color: "#333" }}>
                Set {index + 1}
              </Text>

              <TextInput
                style={{
                  flex: 1,
                  marginRight: 8,
                  backgroundColor: "#f8f8f8",
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 14,
                  textAlign: "center",
                }}
                value={String(item.reps ?? "")}
                onChangeText={(t) => {
                  const next = [...localSets];
                  next[index] = { ...next[index], reps: t || 0 };
                  setLocalSets(next);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#222222"
                selectTextOnFocus={true}
              />

              <TextInput
                style={{
                  flex: 1,
                  marginRight: 8,
                  backgroundColor: "#f8f8f8",
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 14,
                  textAlign: "center",
                }}
                value={String(item.value ?? "")}
                onChangeText={(t) => {
                  const next = [...localSets];
                  next[index] = { ...next[index], value: t || 0 };
                  setLocalSets(next);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#222222"
                selectTextOnFocus={true}
              />

              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: "#f8f8f8",
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 14,
                  textAlign: "center",
                }}
                value={String(item.restMinutes ?? "")}
                onChangeText={(t) => {
                  const next = [...localSets];
                  next[index] = {
                    ...next[index],
                    restMinutes: t || 0,
                  };
                  setLocalSets(next);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#222222"
                selectTextOnFocus={true}
              />
            </View>
          )}
        />

        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: "#6c757d",
              padding: 12,
              borderRadius: 8,
              flex: 1,
              marginRight: 8,
            }}
            onPress={onClose}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "600" }}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: "#28a745",
              padding: 12,
              borderRadius: 8,
              flex: 1,
              marginLeft: 0,
            }}
            onPress={handleSave}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "600" }}
            >
              Save
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
