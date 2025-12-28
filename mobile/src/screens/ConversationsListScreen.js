import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useApi } from "../ApiProvider";
import { getCurrentUserId } from "../utils/jwtUtils";
import handleApiCall from "../utils/apiUtils";
import { showError } from "../utils/errorHandler";
import StyledTextInput from "../components/StyledTextInput";

export default function ConversationsListScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [peerUsername, setPeerUsername] = useState("");
  const [creating, setCreating] = useState(false);
  const { api } = useApi();

  const fetchConversations = async () => {  // todo get this outsourced, this repeats quite a bit
    const data = await handleApiCall(
      () => api.get("/chat/conversations"),
      setLoading,
      "Error fetching conversations"
    );
    if (data) {
      setConversations(data);
    }
  };

  const createConversation = async () => {
    if (!peerUsername.trim()) {
      Alert.alert("Error", "Please enter a username");
      return;
    }

    setCreating(true);
    try {
      const res = await api.post("/chat/conversations", {
        peerUsername: peerUsername.trim(),
      });
      
      setShowNewConversationModal(false);
      setPeerUsername("");
      
      navigation.navigate("Conversation", {
        conversationId: res.data.id,
      });
      
      fetchConversations();
    } catch (error) {
      console.error("Error creating conversation:", error);
      showError(error, "Error", "Failed to create conversation");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
    };
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const getPeerUser = (conversation) => {
    if (!currentUserId) return null;
    
    const participants = conversation.participants || [];
    if (participants.length === 2) {
      const peerParticipant = participants.find(
        (participant) => participant.userId !== currentUserId
      );
      return peerParticipant?.user || null;
    }
    return null;
  };

  const getLastMessage = (conversation) => {
    const messages = conversation.messages || [];
    return messages.length > 0 ? messages[0] : null;
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item: conversation }) => {
    const lastMessage = getLastMessage(conversation);
    const peerUser = getPeerUser(conversation);
    
    const displayName = peerUser?.username || "Unknown";

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => {
          navigation.navigate("Conversation", {
            conversationId: conversation.id,
          });
        }}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>{displayName}</Text>
            {lastMessage && (
              <Text style={styles.timestamp}>
                {formatTime(lastMessage.createdAt)}
              </Text>
            )}
          </View>
          {lastMessage && (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {lastMessage.content}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation with another user
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newMessageButton}
          onPress={() => setShowNewConversationModal(true)}
        >
          <Text style={styles.newMessageButtonText}>+ New Message</Text>
        </TouchableOpacity>

        <Modal
          visible={showNewConversationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowNewConversationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Message</Text>
              <Text style={styles.modalSubtitle}>
                Enter the username of the person you want to message
              </Text>
              <StyledTextInput
                style={styles.userIdInput}
                placeholder="Username"
                value={peerUsername}
                onChangeText={setPeerUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowNewConversationModal(false);
                    setPeerUsername("");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton, creating && styles.createButtonDisabled]}
                  onPress={createConversation}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.createButtonText}>Start Chat</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
      <TouchableOpacity
        style={styles.newMessageButton}
        onPress={() => setShowNewConversationModal(true)}
      >
        <Text style={styles.newMessageButtonText}>+ New Message</Text>
      </TouchableOpacity>

      <Modal
        visible={showNewConversationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewConversationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Message</Text>
            <Text style={styles.modalSubtitle}>
              Enter the username of the person you want to message
            </Text>
            <TextInput
              style={styles.userIdInput}
              placeholder="Username"
              value={peerUsername}
              onChangeText={setPeerUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowNewConversationModal(false);
                  setPeerUserId("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton, creating && styles.createButtonDisabled]}
                onPress={createConversation}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.createButtonText}>Start Chat</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  conversationContent: {
    flex: 1,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  timestamp: {
    fontSize: 12,
    color: "#999",
  },
  lastMessage: {
    fontSize: 14,
    color: "#666",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
  },
  newMessageButton: {
    position: "absolute",
    bottom: Platform.OS === "android" ? 50 : 30,
    right: 20,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  newMessageButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  userIdInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  createButton: {
    backgroundColor: "#007AFF",
  },
  createButtonDisabled: {
    backgroundColor: "#ccc",
  },
  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

