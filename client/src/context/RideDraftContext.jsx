import React, { createContext, useContext, useState, useEffect } from 'react';

const RideDraftContext = createContext(null);

const STORAGE_KEY = 'carpooling_ride_draft';

export function RideDraftProvider({ children }) {
  const [draft, setDraft] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (draft) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        console.warn('Could not save ride draft to sessionStorage:', e);
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [draft]);

  const updateDraft = (data) => {
    setDraft((prev) => ({ ...prev, ...data }));
  };

  const clearDraft = () => {
    setDraft(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  return (
    <RideDraftContext.Provider value={{ draft, setDraft, updateDraft, clearDraft }}>
      {children}
    </RideDraftContext.Provider>
  );
}

export const useRideDraft = () => {
  const context = useContext(RideDraftContext);
  if (!context) {
    throw new Error('useRideDraft must be used within a RideDraftProvider');
  }
  return context;
};

export default RideDraftContext;
