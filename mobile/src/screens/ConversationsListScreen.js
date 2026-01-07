import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useApi } from "../ApiProvider";
import { getCurrentUserId } from "../utils/jwtUtils";
import handleApiCall from "../utils/apiUtils";
import { showError } from "../utils/errorHandler";
import Button from "../components/Button";
import LoadingScreen from "../components/LoadingScreen";
import EmptyState from "../components/EmptyState";
import AppModal from "../components/Modal";
import { showErrorAlert } from "../utils/alert";
import Pressable from "../components/Pressable";
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
      showErrorAlert("Please enter a username");
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
      <Pressable
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
      </Pressable>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          message="No conversations yet"
          subtext="Start a conversation with another user"
        />
        <Button
          title="+ New Message"
          onPress={() => setShowNewConversationModal(true)}
          variant="primary"
          size="large"
          style={styles.newMessageButton}
        />

        <AppModal
          visible={showNewConversationModal}
          onClose={() => {
            setShowNewConversationModal(false);
            setPeerUsername("");
          }}
          title="New Message"
          subtitle="Enter the username of the person you want to message"
        >
          <StyledTextInput
            style={styles.userIdInput}
            placeholder="Username"
            value={peerUsername}
            onChangeText={setPeerUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={() => {
                setShowNewConversationModal(false);
                setPeerUsername("");
              }}
              variant="secondary"
              size="medium"
              style={[styles.modalButton, styles.cancelButton]}
            />
            <Button
              title="Start Chat"
              onPress={createConversation}
              disabled={creating}
              loading={creating}
              variant="primary"
              size="medium"
              style={[styles.modalButton, styles.createButton]}
            />
          </View>
        </AppModal>
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
      <Button
        title="+ New Message"
        onPress={() => setShowNewConversationModal(true)}
        variant="primary"
        size="large"
        style={styles.newMessageButton}
      />

      <AppModal
        visible={showNewConversationModal}
        onClose={() => {
          setShowNewConversationModal(false);
          setPeerUsername("");
        }}
        title="New Message"
        subtitle="Enter the username of the person you want to message"
      >
        <StyledTextInput
          style={styles.userIdInput}
          placeholder="Username"
          value={peerUsername}
          onChangeText={setPeerUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            onPress={() => {
              setShowNewConversationModal(false);
              setPeerUsername("");
            }}
            variant="secondary"
            size="medium"
            style={[styles.modalButton, styles.cancelButton]}
          />
          <Button
            title="Start Chat"
            onPress={createConversation}
            disabled={creating}
            loading={creating}
            variant="primary"
            size="medium"
            style={[styles.modalButton, styles.createButton]}
          />
        </View>
      </AppModal>
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
  newMessageButton: {
    position: "absolute",
    bottom: Platform.OS === "android" ? 80 : 40,
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
    flex: 1,
  },
});

