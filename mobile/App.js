import { useEffect, useMemo, useState, useRef } from "react";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TouchableOpacity, StyleSheet, Image, Text, View, ActivityIndicator, Platform, StatusBar } from "react-native";
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
import ProfileScreen from "./src/screens/ProfileScreen";
import SessionHistoryScreen from "./src/screens/SessionHistoryScreen";
import SessionDetailScreen from "./src/screens/SessionDetailScreen";
import LayoutSelectionScreen from "./src/screens/LayoutSelectionScreen";
import LayoutDetailScreen from "./src/screens/LayoutDetailScreen";
import ClimbDetailScreen from "./src/screens/ClimbDetailScreen";

import { ApiProvider } from "./src/ApiProvider";
import { createApi } from "./src/ApiClient";
import { clearCachedUserId } from "./src/utils/jwtUtils";

const Stack = createNativeStackNavigator();

// Map route names to display titles
const routeTitleMap = {
  "Home": "Home",
  "Create Category": "Create Category",
  "Edit Category": "Edit Category",
  "Create Workout": "Create Workout",
  "Category Workouts": "Category Workouts",
  "Timer": "Timer",
  "Workout Execution": "Workout Execution",
  "Conversations": "Messages",
  "Conversation": "Chat",
  "Profile": "Profile",
  "Sessions": "Sessions",
  "Session Details": "Session Details",
  "Layout Selection": "Gyms",
  "Layout": "Layout",
  "Route": "Route",
};

// Custom Header Component that stays fixed
const CustomHeader = ({ HeaderRightButtons, navigationRef, currentRoute }) => {
  const navigation = useNavigation();
  const title = routeTitleMap[currentRoute] || currentRoute;
  
  // Check if we can go back (not on root/home screen)
  const canGoBack = navigation.canGoBack() && currentRoute !== "Home";

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.customHeader}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <View style={styles.headerContent}>
        <View style={styles.backButtonContainer}>
          {canGoBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
        <HeaderRightButtons navigation={navigation} />
      </View>
    </View>
  );
};

// Navigation Wrapper that includes the fixed header
const NavigationWrapper = ({ isAuthed, HeaderRightButtons, handleLogout, Stack, onLoggedIn, navigationRef, currentRoute }) => {
  const headerHeight = Platform.OS === 'ios' ? 56 : 56 + (StatusBar.currentHeight || 0);
  
  return (
    <View style={styles.container}>
      {isAuthed && <CustomHeader HeaderRightButtons={HeaderRightButtons} navigationRef={navigationRef} currentRoute={currentRoute} />}
      <View style={[styles.navigatorContainer, isAuthed && { paddingTop: headerHeight }]}>
        <Stack.Navigator
          screenOptions={{
            animation: 'slide_from_right',
            animationDuration: 300,
            headerShown: false, // Hide default headers
          }}
        >
        {isAuthed ? (
          <>
            <Stack.Screen
              name="Home"
            >
              {(props) => (
                <HomeScreen {...props} onLogout={handleLogout} />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="Create Category"
              component={CreateCategoryScreen}
            />
            <Stack.Screen
              name="Edit Category"
              component={EditCategoryScreen}
            />
            <Stack.Screen
              name="Create Workout"
              component={CreateWorkoutScreen}
            />
            <Stack.Screen
              name="Category Workouts"
              component={CategoryWorkoutsScreen}
            />
            <Stack.Screen
              name="Timer"
              component={TimerScreen}
            />
            <Stack.Screen
              name="Workout Execution"
              component={WorkoutExecutionScreen}
            />
            <Stack.Screen
              name="Conversations"
              component={ConversationsListScreen}
            />
            <Stack.Screen
              name="Conversation"
              component={ConversationScreen}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
            />
            <Stack.Screen
              name="Sessions"
              component={SessionHistoryScreen}
            />
            <Stack.Screen
              name="Session Details"
              component={SessionDetailScreen}
            />
            <Stack.Screen
              name="Layout Selection"
              component={LayoutSelectionScreen}
            />
            <Stack.Screen
              name="Layout"
              component={LayoutDetailScreen}
            />
            <Stack.Screen
              name="Route"
              component={ClimbDetailScreen}
            />
          </>
        ) : (
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen {...props} onLoggedIn={onLoggedIn} />
            )}
          </Stack.Screen>
        )}
        </Stack.Navigator>
      </View>
    </View>
  );
};

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
  const navigationRef = useRef(null);
  const [currentRoute, setCurrentRoute] = useState("Home");
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
    clearCachedUserId();
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

  const ProfileButton = ({ navigation }) => (
    <TouchableOpacity
      style={styles.preferencesButton}
      onPress={() => navigation.navigate("Profile")}
    >
      <Text style={styles.preferencesIcon}>⚙️</Text>
    </TouchableOpacity>
  );

  const HeaderRightButtons = ({ navigation }) => (
    <View style={styles.headerRightContainer}>
      <ProfileButton navigation={navigation} />
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

  const handleStateChange = (state) => {
    if (state) {
      const route = state.routes[state.index];
      setCurrentRoute(route?.name || "Home");
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ApiProvider value={{ api, setAuthToken }}>
        <NavigationContainer ref={navigationRef} onStateChange={handleStateChange}>
          <NavigationWrapper 
            isAuthed={isAuthed} 
            HeaderRightButtons={HeaderRightButtons} 
            handleLogout={handleLogout}
            Stack={Stack}
            onLoggedIn={() => setIsAuthed(true)}
            navigationRef={navigationRef}
            currentRoute={currentRoute}
          />
        </NavigationContainer>
      </ApiProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navigatorContainer: {
    flex: 1,
  },
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    zIndex: 1000,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
  },
  backButtonContainer: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 24,
    color: '#1D1D1F',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1D1D1F',
    flex: 1,
  },
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
