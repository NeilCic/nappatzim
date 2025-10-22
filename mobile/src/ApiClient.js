import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";

export function createApi({ baseURL, onAuthFailure }) {
  const api = axios.create({ baseURL });

  const setAuthToken = (token) => {
    if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete api.defaults.headers.common.Authorization;
  };

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      if (
        error.response?.status === 401 &&
        !original?._retry &&
        !original.url?.includes("/auth/login") &&
        !original.url?.includes("/auth/register")
      ) {
        original._retry = true;
        try {
          const refreshToken = await AsyncStorage.getItem("refreshToken");
          if (!refreshToken) throw new Error("No refresh token");
          const r = await axios.post(`${baseURL}/auth/refresh`, {
            refreshToken,
          });
          const newAccess = r.data?.accessToken;
          if (!newAccess) throw new Error("No access token");
          await AsyncStorage.setItem("token", newAccess);
          setAuthToken(newAccess);
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        } catch {
          await AsyncStorage.multiRemove(["token", "refreshToken"]);
          setAuthToken(undefined);
          Alert.alert(
            "Authentication",
            "Session expired. Please log in again."
          );
          onAuthFailure?.();
          return Promise.reject(new axios.Cancel("auth-failed"));
        }
      }

      if (
        original.url?.includes("/auth/login") ||
        original.url?.includes("/auth/register")
      ) {
        const errorMessage =
          error.response?.data?.error || "Authentication failed";
        Alert.alert("Login Failed", errorMessage);
      }
      
      return Promise.reject(error);
    }
  );

  return { api, setAuthToken };
}
