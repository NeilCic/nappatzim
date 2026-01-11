import AsyncStorage from "@react-native-async-storage/async-storage";

// Simple in-memory cache for userId to avoid repeated JWT decoding
let cachedUserId = null;
let cachedToken = null;

// Base64 decode polyfill for React Native
function base64Decode(str) {
  // React Native doesn't have atob, so we use a polyfill
  if (typeof atob !== "undefined") {
    return atob(str);
  }
  
  // Manual base64 decoding
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  
  str = str.replace(/[^A-Za-z0-9\+\/\=]/g, "");
  
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = chars.indexOf(str.charAt(i));
    const enc2 = chars.indexOf(str.charAt(i + 1));
    const enc3 = chars.indexOf(str.charAt(i + 2));
    const enc4 = chars.indexOf(str.charAt(i + 3));
    
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    
    output += String.fromCharCode(chr1);
    
    // Check for padding: '=' is not in the base64 alphabet, so indexOf returns -1
    // Also check if enc3 is valid (not -1) before outputting chr2
    if (enc3 !== -1 && str.charAt(i + 2) !== '=') {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== -1 && str.charAt(i + 3) !== '=') {
      output += String.fromCharCode(chr3);
    }
  }
  
  return output;
}


export function decodeJWT(token) {
  if (!token) return null;
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(
      base64Decode(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function getCurrentUserId() {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      cachedUserId = null;
      cachedToken = null;
      return null;
    }
    
    if (cachedUserId && cachedToken === token) {
      return cachedUserId;
    }
    
    const decoded = decodeJWT(token);
    const userId = decoded?.userId || null;
    
    cachedUserId = userId;
    cachedToken = token;
    
    return userId;
  } catch (error) {
    cachedUserId = null;
    cachedToken = null;
    return null;
  }
}

export function clearCachedUserId() {
  cachedUserId = null;
  cachedToken = null;
}

/**
 * Fetches the current user's username from the API
 * @param {Object} api - The API instance from useApi hook
 * @returns {Promise<string|null>} The username or null if not found
 */
export async function getCurrentUsername(api) {
  if (!api) return null;
  
  try {
    const response = await api.get("/auth/me");
    return response?.data?.username || null;
  } catch (error) {
    return null;
  }
}

