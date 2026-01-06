import { useEffect, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TouchableOpacity, StyleSheet, Image, Text, View, ActivityIndicator } from "react-native";
import axios from "axios";
import Constants from "expo-constants";

import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CreateCategoryScreen from "./src/screens/CreateCategoryScreen";
import EditCategoryScreen from "./src/screens/EditCategoryScreen";
import CreateWorkoutScreen from "./src/screens/CreateWorkoutScreen";
import CategoryWorkoutsScreen from "./src/screens/CategoryWorkoutScreen";
import TimerScreen from "./src/screens/TimerScreen";
import WorkoutExecutionScreen from "./src/screens/WorkoutExecutionScreen";
import ConversationsListScreen from "./src/screens/ConversationsListScreen";
import ConversationScreen from "./src/screens/ConversationScreen";
import PreferencesScreen from "./src/screens/PreferencesScreen";
import LayoutSelectionScreen from "./src/screens/LayoutSelectionScreen";
import LayoutDetailScreen from "./src/screens/LayoutDetailScreen";

import { ApiProvider } from "./src/ApiProvider";
import { createApi } from "./src/ApiClient";

const Stack = createNativeStackNavigator();

const getApiBaseUrl = () => {
  // Explicitly check for false, default to true (production)
  const useProduction = Constants.expoConfig?.extra?.useProduction !== false;
  const baseUrl = useProduction
    ? "https://nappatzim.onrender.com"
    : "http://192.168.1.215:3000";
  
  // Safety check: in production builds, always use production URL
  if (__DEV__ === false && !baseUrl.includes('onrender.com')) {
    return "https://nappatzim.onrender.com";
  }
  
  return baseUrl;
};

export default function App() {
  const [isAuthed, setIsAuthed] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const { api, setAuthToken } = useMemo(
    () =>
      createApi({
        baseURL: apiBaseUrl,
        onAuthFailure: () => setIsAuthed(false),
      }),
    [apiBaseUrl]
  );

  const clearAuth = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken"]);
    setAuthToken(undefined);
    setIsAuthed(false);
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        setIsBootstrapping(true);
        const token = await AsyncStorage.getItem("token");
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        
        if (token) {
          setAuthToken(token);
          
          // Retry /auth/me up to 6 times with 10-second delays to handle Render wake-up
          const maxRetries = 6;
          const retryDelay = 10000; // 10 seconds
          let lastError = null;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              await api.get("/auth/me");
              // Success - token is valid
              setIsAuthed(true);
              return;
            } catch (error) {
              lastError = error;
              const status = error.response?.status;
              
              // If 401, token is invalid - don't retry, try refresh token instead
              if (status === 401) {
                if (refreshToken) {
                  try {
                    // Use axios directly to avoid interceptor issues
                    const response = await axios.post(`${apiBaseUrl}/auth/refresh`, { refreshToken });
                    const newAccessToken = response.data?.accessToken;
                    
                    if (!newAccessToken) {
                      throw new Error("No access token in response");
                    }
                    
                    await AsyncStorage.setItem("token", newAccessToken);
                    setAuthToken(newAccessToken);
                    setIsAuthed(true);
                    return;
                  } catch (refreshError) {
                    await clearAuth();
                    return;
                  }
                } else {
                  await clearAuth();
                  return;
                }
              }
              
              // If 404, endpoint doesn't exist - don't retry
              if (status === 404) {
                await clearAuth();
                return;
              }
              
              // Network error or other error - retry if we have attempts left
              if (attempt < maxRetries) {
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
              }
            }
          }
          
          // All retries exhausted - show login
          setIsAuthed(false);
        } else {
          setIsAuthed(false);
        }
      } catch (error) {
        // Unexpected error - show login
        setIsAuthed(false);
      } finally {
        setIsBootstrapping(false);
      }
    };
    bootstrapAuth();
  }, [setAuthToken, api, apiBaseUrl]);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          Waking up server and checking your session...
        </Text>
      </View>
    );
  }

  const PreferencesButton = ({ navigation }) => (
    <TouchableOpacity
      style={styles.preferencesButton}
      onPress={() => navigation.navigate("Preferences")}
    >
      <Text style={styles.preferencesIcon}>⚙️</Text>
    </TouchableOpacity>
  );

  const HeaderRightButtons = ({ navigation }) => (
    <View style={styles.headerRightContainer}>
      <PreferencesButton navigation={navigation} />
      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => navigation.navigate("Conversations")}
      >
        <Text style={styles.chatIcon}>💬</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => navigation.navigate("Layout Selection")}
      >
        <Text style={styles.mapIcon}>🗺️</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.timerButton}
        onPress={() => navigation.navigate("Timer")}
      >
        <Image
          source={require("./assets/timer-icon.png")}
          style={styles.timerIcon}
        />
      </TouchableOpacity>
    </View>
  );

  const handleLogout = async () => {
    try {
      // Clear tokens immediately (don't wait for API calls)
      await AsyncStorage.multiRemove(["token", "refreshToken"]);
      setAuthToken(undefined);
      setIsAuthed(false);
    } catch (error) {
      // Even if clearing storage fails, force logout
      setAuthToken(undefined);
      setIsAuthed(false);
    }
  };

  return (
    <ApiProvider value={{ api, setAuthToken }}>
      <NavigationContainer>
        <Stack.Navigator>
          {isAuthed ? (
            <>
              <Stack.Screen
                name="Home"
                options={({ navigation }) => ({
                  title: "Home",
                  headerRight: () => <HeaderRightButtons navigation={navigation} />,
                })}
              >
                {(props) => (
                  <HomeScreen {...props} onLogout={handleLogout} />
                )}
              </Stack.Screen>
              <Stack.Screen
                name="Create Category"
                component={CreateCategoryScreen}
                options={({ navigation }) => ({
                  headerRight: () => <HeaderRightButtons navigation={navigation} />,
                })}
              />
              <Stack.Screen
                name="Edit Category"
                component={EditCategoryScreen}
                options={({ navigation }) => ({
                  headerRight: () => <HeaderRightButtons navigation={navigation} />,
                })}
              />
              <Stack.Screen
                name="Create Workout"
                component={CreateWorkoutScreen}
                options={({ navigation }) => ({
                  headerRight: () => <HeaderRightButtons navigation={navigation} />,
                })}
              />
              <Stack.Screen
                name="Category Workouts"
                component={CategoryWorkoutsScreen}
                options={({ navigation }) => ({
                  headerRight: () => <HeaderRightButtons navigation={navigation} />,
                })}
              />
              <Stack.Screen name="Timer" component={TimerScreen} />
              <Stack.Screen
                name="Workout Execution"
                component={WorkoutExecutionScreen}
              />
              <Stack.Screen
                name="Conversations"
                component={ConversationsListScreen}
                options={{ title: "Messages" }}
              />
              <Stack.Screen
                name="Conversation"
                component={ConversationScreen}
                options={{ title: "Chat" }}
              />
              <Stack.Screen
                name="Preferences"
                component={PreferencesScreen}
                options={{ title: "Preferences" }}
              />
              <Stack.Screen
                name="Layout Selection"
                component={LayoutSelectionScreen}
                options={({ navigation }) => ({
                  title: "Gym Layouts",
                  headerRight: () => <HeaderRightButtons navigation={navigation} />,
                })}
              />
              <Stack.Screen
                name="Layout Detail"
                component={LayoutDetailScreen}
                options={({ navigation }) => ({
                  title: "Layout Detail",
                  headerRight: () => <HeaderRightButtons navigation={navigation} />,
                })}
              />
            </>
          ) : (
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen {...props} onLoggedIn={() => setIsAuthed(true)} />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ApiProvider>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  preferencesButton: {
    padding: 8,
    marginRight: 8,
  },
  preferencesIcon: {
    fontSize: 24,
  },
  chatButton: {
    padding: 8,
    marginRight: 8,
  },
  chatIcon: {
    fontSize: 24,
  },
  mapButton: {
    padding: 8,
    marginRight: 8,
  },
  mapIcon: {
    fontSize: 24,
  },
  timerButton: {
    padding: 8,
  },
  timerIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000", // match your app background if different
  },
  loadingText: {
    marginTop: 16,
    color: "#fff",
    fontSize: 16,
  },
});
