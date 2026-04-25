"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface HighContrastContextValue {
  highContrast: boolean;
  toggleHighContrast: () => void;
}

export const HighContrastContext = createContext<HighContrastContextValue>({
  highContrast: false,
  toggleHighContrast: () => {},
});

export function HighContrastProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("highContrast");
    if (stored === "true") {
      setHighContrast(true);
      document.documentElement.setAttribute("data-high-contrast", "true");
    }
  }, []);

  const toggleHighContrast = () => {
    setHighContrast((prev) => {
      const next = !prev;
      localStorage.setItem("highContrast", String(next));
      document.documentElement.setAttribute("data-high-contrast", String(next));
      return next;
    });
  };

  return (
    <HighContrastContext.Provider value={{ highContrast, toggleHighContrast }}>
      {children}
    </HighContrastContext.Provider>
  );
}
