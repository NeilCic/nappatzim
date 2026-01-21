import { createContext, useContext } from "react";

const UserContext = createContext(null);

export const UserProvider = ({ value, children }) => (
  <UserContext.Provider value={value}>{children}</UserContext.Provider>
);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
};

