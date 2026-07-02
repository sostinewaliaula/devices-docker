import React, { useEffect, useState, createContext, useContext } from 'react';
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
}> = ({
  children
}) => {
    const [theme, setTheme] = useState<Theme>(() => {
      const savedTheme = localStorage.getItem('theme') as Theme;
      return savedTheme || 'system';
    });

    useEffect(() => {
      const applyTheme = () => {
        let appliedTheme: 'light' | 'dark';

        if (theme === 'system') {
          appliedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
          appliedTheme = theme;
        }

        if (appliedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };

      applyTheme();
      localStorage.setItem('theme', theme);

      // If system theme changes and we're in system mode, re-apply
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = () => {
        if (theme === 'system') {
          applyTheme();
        }
      };

      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, [theme]);

    const toggleTheme = () => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme
    }}>
      {children}
    </ThemeContext.Provider>;
  };
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
