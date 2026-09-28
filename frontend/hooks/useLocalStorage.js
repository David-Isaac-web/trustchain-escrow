import { useState } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue((previousValue) => {
        const nextValue = value instanceof Function ? value(previousValue) : value;

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        }

        return nextValue;
      });
    } catch (error) {
      console.error(`useLocalStorage: failed to set key "${key}"`, error);
    }
  };

  return [storedValue, setValue];
}
