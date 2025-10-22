import { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApi } from "../ApiProvider";
import axios from 'axios';

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const { api, setAuthToken } = useApi();

  const login = async () => {
    setErr(null);
    try {
      setLoading(true);
      const res = await api.post("/auth/login", { email, password });
      const { accessToken, refreshToken } = res.data;
      await AsyncStorage.multiSet([
        ["token", accessToken],
        ["refreshToken", refreshToken],
      ]);
      setAuthToken(accessToken);
      onLoggedIn();
      setLoading(false);
    } catch (e) {
      setLoading(false);
      if (axios.isCancel(e)) return;
      setErr(e?.response?.data?.message || "Login failed");
    }
  };

  const register = async () => {
    try {
      setLoading(true);
      await api.post("/auth/register", {email, password });
      setLoading(false);
      await login();
    } catch (e) {
      setLoading(false);
      if (axios.isCancel(e)) return;
      setErr(e?.response?.data?.message || "Register failed");
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />
      {err ? <Text style={{ color: "red" }}>{err}</Text> : null}
      <Button title="Login" onPress={login} disabled={loading} />
      <Button title="Register" onPress={register} disabled={loading} />
      { loading && <Text> Loading... </Text> }
    </View>
  );
}
