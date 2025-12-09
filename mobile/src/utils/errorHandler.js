import { Alert } from "react-native";

export const isNetworkError = (error) => {
  return (
    !error.response &&
    (error.code === "ERR_NETWORK" ||
      error.code === "ECONNABORTED" ||
      error.message?.includes("Network Error") ||
      error.message?.includes("timeout") ||
      error.message?.includes("ENOTFOUND"))
  );
};

export const isTimeoutError = (error) => {
  return error.code === "ECONNABORTED" || error.message?.includes("timeout");
};

export const isServerError = (error) => {
  return error.response?.status >= 500 && error.response?.status < 600;
};


export const isClientError = (error) => {
  return error.response?.status >= 400 && error.response?.status < 500;
};

// Extracts a user-friendly error message from an axios error
export const getErrorMessage = (error, defaultMessage = "Something went wrong") => {
  // Network/connectivity errors
  if (!error.response) {
    if (isTimeoutError(error)) {
      return "Request timed out. Please check your connection and try again.";
    }
    if (isNetworkError(error)) {
      if (error.message?.includes("ENOTFOUND") || error.message?.includes("getaddrinfo")) {
        return "Cannot reach server. Please check your internet connection.";
      }
      return "Unable to connect to server. Please check your internet connection.";
    }
    return "Connection error. Please check your internet and try again.";
  }

  const status = error.response.status;
  const serverMessage = error.response?.data?.error || error.response?.data?.message;
  // Use server message if available
  if (serverMessage) {
    return serverMessage;
  }

  // Handle server errors (5xx)
  if (isServerError(error)) {
    switch (status) {
      case 500:
        return "Server error. Please try again later.";
      case 502:
      case 503:
      case 504:
        return "Server is temporarily unavailable. Please try again later.";
      default:
        return "Server error. Please try again later.";
    }
  }

  // Handle client errors (4xx)
  if (isClientError(error)) {
    switch (status) {
      case 400:
        return "Invalid request. Please check your input and try again.";
      case 401:
        return "Authentication failed. Please log in again.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 409:
        return "This resource already exists. Please try a different value.";
      case 422:
        return "Validation error. Please check your input.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      default:
        return defaultMessage;
    }
  }

  return defaultMessage;
};

export const showError = (error, title = "Error", defaultMessage = "Something went wrong") => {
  const message = getErrorMessage(error, defaultMessage);
  Alert.alert(title, message);
};
