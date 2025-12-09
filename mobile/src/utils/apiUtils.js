import axios from "axios";
import { Alert } from "react-native";
import { getErrorMessage } from "./errorHandler";

const handleApiCall = async (apiCall, setLoading, errorMessage = null, showAlert = false) => {
  if (typeof apiCall !== "function") {
    console.error("handleApiCall: apiCall must be a function, got:", typeof apiCall, apiCall);
    return null;
  }

  try {
    if (setLoading && typeof setLoading === "function") {
      setLoading(true);
    }
    const res = await apiCall();
    return res?.data || res;
  } catch (error) {
    if (axios.isCancel(error)) return null;
    
    const message = getErrorMessage(error, errorMessage || "API call failed");
    console.error(message, error);
    
    if (showAlert) {
      Alert.alert("Error", message);
    }
    
    return null;
  } finally {
    if (setLoading && typeof setLoading === "function") {
      setLoading(false);
    }
  }
};

export default handleApiCall;

