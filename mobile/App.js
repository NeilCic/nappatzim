import { useEffect, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TouchableOpacity, StyleSheet, Image } from "react-native";

import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CreateCategoryScreen from "./src/screens/CreateCategoryScreen";
import CreateWorkoutScreen from "./src/screens/CreateWorkoutScreen";
import CategoryWorkoutsScreen from "./src/screens/CategoryWorkoutScreen";
import TimerScreen from "./src/screens/TimerScreen";
import WorkoutExecutionScreen from "./src/screens/WorkoutExecutionScreen";

import { ApiProvider } from "./src/ApiProvider";
import { createApi } from "./src/ApiClient";

const Stack = createNativeStackNavigator();
const USE_PRODUCTION = true;

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

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (token) {
          setAuthToken(token);
          setIsAuthed(true);
        } else {
          setIsAuthed(false);
        }
      } catch {
        await AsyncStorage.multiRemove(["token", "refreshToken"]);
        setIsAuthed(false);
      }
    };
    bootstrapAuth();
  }, [setAuthToken]);

  const TimerButton = ({ navigation }) => (
    <TouchableOpacity
      style={styles.timerButton}
      onPress={() => navigation.navigate("Timer")}
    >
      <Image
        source={require("./assets/timer-icon.png")}
        style={styles.timerIcon}
      />
    </TouchableOpacity>
  );

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken"]);
    setAuthToken(undefined);
    setIsAuthed(false);
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
                  headerRight: () => <TimerButton navigation={navigation} />,
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
                  headerRight: () => <TimerButton navigation={navigation} />,
                })}
              />
              <Stack.Screen
                name="Create Workout"
                component={CreateWorkoutScreen}
                options={({ navigation }) => ({
                  headerRight: () => <TimerButton navigation={navigation} />,
                })}
              />
              <Stack.Screen
                name="Category Workouts"
                component={CategoryWorkoutsScreen}
                options={({ navigation }) => ({
                  headerRight: () => <TimerButton navigation={navigation} />,
                })}
              />
              <Stack.Screen name="Timer" component={TimerScreen} />
              <Stack.Screen
                name="Workout Execution"
                component={WorkoutExecutionScreen}
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
  timerButton: {
    padding: 8,
    marginRight: 16,
  },
  timerIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
});
