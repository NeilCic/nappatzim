import { useEffect, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TouchableOpacity, StyleSheet, Image, Text, View } from "react-native";
import axios from "axios";

import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CreateCategoryScreen from "./src/screens/CreateCategoryScreen";
import CreateWorkoutScreen from "./src/screens/CreateWorkoutScreen";
import CategoryWorkoutsScreen from "./src/screens/CategoryWorkoutScreen";
import TimerScreen from "./src/screens/TimerScreen";
import WorkoutExecutionScreen from "./src/screens/WorkoutExecutionScreen";
import ConversationsListScreen from "./src/screens/ConversationsListScreen";
import ConversationScreen from "./src/screens/ConversationScreen";
import PreferencesScreen from "./src/screens/PreferencesScreen";
import LayoutSelectionScreen from "./src/screens/LayoutSelectionScreen";

import { ApiProvider } from "./src/ApiProvider";
import { createApi } from "./src/ApiClient";

const Stack = createNativeStackNavigator();
const USE_PRODUCTION = false;

const API_BASE_URL = USE_PRODUCTION
  ? "https://nappatzim.onrender.com"
  : "http://192.168.1.215:3000";

export default function App() {
  const [isAuthed, setIsAuthed] = useState(null);

  const { api, setAuthToken } = useMemo(
    () =>
      createApi({
        baseURL: API_BASE_URL,
        onAuthFailure: () => setIsAuthed(false),
      }),
    []
  );

  const clearAuth = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken"]);
    setAuthToken(undefined);
    setIsAuthed(false);
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        
        if (token) {
          setAuthToken(token);
          
          // Verify token is valid by making a test request
          try {
            await api.get("/auth/me");
            setIsAuthed(true);
          } catch (error) {
            const status = error.response?.status;
            
            if (status === 401) {
              if (refreshToken) {
                try {
                  // Use axios directly to avoid interceptor issues
                  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
                  const newAccessToken = response.data?.accessToken;
                  
                  if (!newAccessToken) {
                    throw new Error("No access token in response");
                  }
                  
                  await AsyncStorage.setItem("token", newAccessToken);
                  setAuthToken(newAccessToken);
                  setIsAuthed(true);
                } catch (refreshError) {
                  await clearAuth();
                }
              } else {
                await clearAuth();
              }
            } else if (status === 404) {
              await clearAuth();
            } else {
              // Network error or other error - don't authenticate
              setIsAuthed(false);
            }
          }
        } else {
          setIsAuthed(false);
        }
      } catch (error) {
        if (!error.message?.includes("Network") && error.code !== "NETWORK_ERROR") {
          await clearAuth();
        } else {
          setIsAuthed(false);
        }
      }
    };
    bootstrapAuth();
  }, [setAuthToken]);

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
      console.error("Logout error:", error);
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
                  title: "Workout",
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
});
