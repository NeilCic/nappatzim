import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useApi } from "../ApiProvider";
import { getCurrentUserId } from "../utils/jwtUtils";
import handleApiCall from "../utils/apiUtils";
import axios from "axios";
import StyledTextInput from "../components/StyledTextInput";
import Button from "../components/Button";
import LoadingScreen from "../components/LoadingScreen";
import KeyboardAvoidingContainer from "../components/KeyboardAvoidingContainer";

export default function ConversationScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const flatListRef = useRef(null);
  const { api } = useApi();

  const fetchMessages = async () => {
    if (!api) {
      return;
    }
    
    const data = await handleApiCall(
      () => {
        if (!api || typeof api.get !== "function") {
          throw new Error("api.get is not a function");
        }
        return api.get(`/chat/conversations/${conversationId}/messages`);
      },
      setLoading,
      "Error fetching messages"
    );
    
    if (data) {
      const fetchedMessages = data.reverse();
      setMessages(fetchedMessages);
      
      if (fetchedMessages.length > 0) {
        const latestMessage = fetchedMessages[fetchedMessages.length - 1];
        await handleApiCall(
          () => {
            if (!api || typeof api.post !== "function") {
              throw new Error("api.post is not a function");
            }
            return api.post(`/chat/conversations/${conversationId}/read`, {
              upTo: latestMessage.createdAt,
            });
          },
          null, // No loading state for mark-as-read
          "Error marking messages as read"
        );
      }
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
      fetchMessages();
    }, [conversationId])
  );

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;

    const content = messageText.trim();
    setMessageText("");
    setSending(true);

    try {
      const res = await api.post(
        `/chat/conversations/${conversationId}/messages`,
        { content }
      );
      
      setMessages((prev) => [...prev, res.data]);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      if (axios.isCancel(error)) return;
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  const importWorkout = async (workoutData) => {
    navigation.navigate("Create Workout", {
      sharedWorkout: workoutData,
    });
  };

  const renderMessage = ({ item: message, index }) => {
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDate =
      !prevMessage ||
      new Date(message.createdAt).toDateString() !==
        new Date(prevMessage.createdAt).toDateString();

    const isCurrentUser = currentUserId && message.senderId === currentUserId;
    const hasWorkoutData = message.workoutData != null;

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(message.createdAt)}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isCurrentUser ? styles.myMessage : styles.otherMessage,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isCurrentUser ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {message.content}
          </Text>
          {hasWorkoutData && !isCurrentUser && (
            <Button
              title="📥 Import Workout"
              onPress={() => importWorkout(message.workoutData)}
              variant="primary"
              size="small"
              style={styles.importButton}
            />
          )}
          <Text
            style={[
              styles.messageTime,
              isCurrentUser ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatTime(message.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingContainer
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 140 : 110}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
        />
        <View style={styles.inputContainer}>
          <StyledTextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
          />
          <Button
            title="Send"
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
            loading={sending}
            variant="primary"
            size="small"
            style={styles.sendButton}
          />
        </View>
      </KeyboardAvoidingContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: "#999",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    maxWidth: "75%",
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: "white",
  },
  otherMessageText: {
    color: "#333",
  },
  messageTime: {
    fontSize: 11,
    alignSelf: "flex-end",
  },
  myMessageTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  otherMessageTime: {
    color: "#999",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    minWidth: 60,
    borderRadius: 20,
  },
  importButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  importButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});

