import { createContext, useContext } from 'react';

const ApiContext = createContext(null);
export const ApiProvider = ({ value, children }) => (
  <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
);
export const useApi = () => {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
};