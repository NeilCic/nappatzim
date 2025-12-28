import { useState } from "react";
import { View, Button, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApi } from "../ApiProvider";
import axios from 'axios';
import { getErrorMessage } from "../utils/errorHandler";
import { VALIDATION } from "../shared/constants.js";
import StyledTextInput from "../components/StyledTextInput";

// Validation functions matching backend schema
const validateEmail = (email) => {
  if (!email || email.trim().length === 0) {
    return "Email is required";
  }
  if (email.length < VALIDATION.EMAIL.MIN_LENGTH) {
    return `Email has to be at least ${VALIDATION.EMAIL.MIN_LENGTH} characters`;
  }
  if (email.length > VALIDATION.EMAIL.MAX_LENGTH) {
    return `Email can't be more than ${VALIDATION.EMAIL.MAX_LENGTH} characters`;
  }
  return null;
};

const validatePassword = (password) => {
  if (!password || password.trim().length === 0) {
    return "Password is required";
  }
  if (password.length < VALIDATION.PASSWORD.MIN_LENGTH) {
    return `Password has to be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters`;
  }
  if (password.length > VALIDATION.PASSWORD.MAX_LENGTH) {
    return `Password can't be more than ${VALIDATION.PASSWORD.MAX_LENGTH} characters`;
  }
  return null;
};

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [generalError, setGeneralError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { api, setAuthToken } = useApi();

  const handleEmailChange = (text) => {
    setEmail(text);
    // Clear errors when user starts typing
    if (emailError) {
      setEmailError(null);
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const handlePasswordChange = (text) => {
    setPassword(text);
    // Clear errors when user starts typing
    if (passwordError) {
      setPasswordError(null);
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const validateForm = () => {
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    
    return !emailErr && !passwordErr;
  };

  const login = async () => {
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    if (!validateForm()) {
      return;
    }

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
      
      const errorMessage = getErrorMessage(e, "Login failed");
      
      if (e.response?.data?.fields) {
        const fields = e.response.data.fields;
        if (fields.email) {
          setEmailError(fields.email);
        }
        if (fields.password) {
          setPasswordError(fields.password);
        }
        // If we have field errors, don't show general error
        if (fields.email || fields.password) {
          return;
        }
      }
      
      if (errorMessage.toLowerCase().includes("password")) {
        setPasswordError(errorMessage);
      }
      else if (errorMessage.toLowerCase().includes("email") || errorMessage.toLowerCase().includes("user name")) {
        setEmailError(errorMessage);
      }
      else {
        setGeneralError(errorMessage);
      }
    }
  };

  const register = async () => {
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    // Validate before API call
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/register", { email, password });
      setLoading(false);
      await login();
    } catch (e) {
      setLoading(false);
      if (axios.isCancel(e)) return;
      
      const errorMessage = getErrorMessage(e, "Register failed");
      
      if (e.response?.data?.fields) {
        const fields = e.response.data.fields;
        if (fields.email) {
          setEmailError(fields.email);
        }
        if (fields.password) {
          setPasswordError(fields.password);
        }
        if (fields.email || fields.password) {
          return;
        }
      }
      
      if (errorMessage.toLowerCase().includes("password")) {
        setPasswordError(errorMessage);
      }
      else if (errorMessage.toLowerCase().includes("email") || errorMessage.toLowerCase().includes("user name")) {
        setEmailError(errorMessage);
      }
      else {
        setGeneralError(errorMessage);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputGroup}>
        <StyledTextInput
          placeholder="Email"
          autoCapitalize="none"
          value={email}
          onChangeText={handleEmailChange}
          style={[
            styles.input,
            emailError && styles.inputError
          ]}
        />
        {emailError && (
          <Text style={styles.errorText}>{emailError}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <StyledTextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={handlePasswordChange}
          style={[
            styles.input,
            passwordError && styles.inputError
          ]}
        />
        {passwordError && (
          <Text style={styles.errorText}>{passwordError}</Text>
        )}
      </View>

      {generalError && !emailError && !passwordError && (
        <Text style={styles.generalErrorText}>{generalError}</Text>
      )}

      <Button title="Login" onPress={login} disabled={loading} />
      <Button title="Register" onPress={register} disabled={loading} />
      {loading && <Text style={styles.loadingText}>Loading...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#ff3b30",
    borderWidth: 2,
  },
  errorText: {
    color: "#ff3b30",
    fontSize: 12,
    marginTop: -4,
    marginLeft: 4,
  },
  generalErrorText: {
    color: "#ff3b30",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  loadingText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
});
