import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemePreset = 
  | 'dark' 
  | 'light' 
  | 'oled' 
  | 'cyberpunk' 
  | 'forest' 
  | 'ocean' 
  | 'sunset';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

const themePresets: Record<ThemePreset, ThemeColors> = {
  dark: {
    background: '#0a0e27', // true dark
    surface: '#141829', // darker surface
    card: '#1a1f3a', // darker card
    border: '#2d3454',
    text: '#e8ebf0', // off-white
    textSecondary: '#a8b1c9', // subtle secondary
    accent: '#5b9bff', // brighter blue for contrast
    accentHover: '#3b82f6', // darker on hover
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ff5555',
    info: '#06b6d4',
  },
  light: {
    background: '#f5f7fa', // very light gray
    surface: '#ffffff', // pure white
    card: '#eef1f6', // light gray-blue
    border: '#d1dae5', // subtle border
    text: '#1a202c', // near black
    textSecondary: '#4a5568', // medium gray
    accent: '#2563eb', // strong blue
    accentHover: '#1d4ed8', // darker blue
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0891b2',
  },
  oled: {
    background: '#000000',
    surface: '#000000',
    card: '#1a1a1a',
    border: '#333333',
    text: '#ffffff',
    textSecondary: '#cccccc',
    accent: '#00ff88',
    accentHover: '#00cc6a',
    success: '#00ff88',
    warning: '#ffaa00',
    error: '#ff4444',
    info: '#00aaff',
  },
  cyberpunk: {
    background: '#1a0033',
    surface: '#2d004d',
    card: '#400066',
    border: '#660099',
    text: '#ff00ff',
    textSecondary: '#cc66ff',
    accent: '#00ff00',
    accentHover: '#00cc00',
    success: '#00ff00',
    warning: '#ffaa00',
    error: '#ff0066',
    info: '#00ffff',
  },
  forest: {
    background: '#1a2e1a',
    surface: '#2d4d2d',
    card: '#3d6b3d',
    border: '#4d7d4d',
    text: '#d4e8d4',
    textSecondary: '#a8d1a8',
    accent: '#52c852',
    accentHover: '#42a842',
    success: '#52c852',
    warning: '#d4a017',
    error: '#b85454',
    info: '#5aacac',
  },
  ocean: {
    background: '#0a1a2e',
    surface: '#162b4d',
    card: '#1e3a5f',
    border: '#2d4d73',
    text: '#cce5ff',
    textSecondary: '#99ccff',
    accent: '#00a3ff',
    accentHover: '#007acc',
    success: '#2ecc71',
    warning: '#f39c12',
    error: '#e74c3c',
    info: '#3498db',
  },
  sunset: {
    background: '#2d1a0f',
    surface: '#4d2e1a',
    card: '#6b3d24',
    border: '#8b4d2e',
    text: '#ffe8d4',
    textSecondary: '#ffcc99',
    accent: '#ff6b3d',
    accentHover: '#cc5431',
    success: '#52c852',
    warning: '#ff8c42',
    error: '#ff4444',
    info: '#ffa366',
  },
};

interface ThemeContextType {
  preset: ThemePreset;
  colors: ThemeColors;
  setPreset: (preset: ThemePreset) => void;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<ThemePreset>(() => {
    const saved = localStorage.getItem('theme-preset');
    return (saved as ThemePreset) || 'dark';
  });

  const [fontSize, setFontSizeState] = useState<'small' | 'medium' | 'large'>(() => {
    const saved = localStorage.getItem('font-size');
    return (saved as 'small' | 'medium' | 'large') || 'medium';
  });

  const [opacity, setOpacityState] = useState(() => {
    const saved = localStorage.getItem('opacity');
    return saved ? parseFloat(saved) : 0.95;
  });

  const [highContrast, setHighContrastState] = useState(() => {
    return localStorage.getItem('high-contrast') === 'true';
  });

  const setPreset = (newPreset: ThemePreset) => {
    setPresetState(newPreset);
    localStorage.setItem('theme-preset', newPreset);
    document.documentElement.setAttribute('data-theme', newPreset);
  };

  const setFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSizeState(size);
    localStorage.setItem('font-size', size);
    document.documentElement.setAttribute('data-font-size', size);
  };

  const setOpacity = (value: number) => {
    setOpacityState(value);
    localStorage.setItem('opacity', value.toString());
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
    localStorage.setItem('high-contrast', enabled.toString());
  };

  // Apply theme colors to CSS variables
  useEffect(() => {
    console.log(`[Theme] Applying preset: ${preset}`);
    const colors = themePresets[preset];
    const root = document.documentElement;
    
    // Apply all CSS variables immediately
    root.style.setProperty('--theme-bg', colors.background);
    root.style.setProperty('--theme-surface', colors.surface);
    root.style.setProperty('--theme-card', colors.card);
    root.style.setProperty('--theme-border', colors.border);
    root.style.setProperty('--theme-text', colors.text);
    root.style.setProperty('--theme-text-secondary', colors.textSecondary);
    root.style.setProperty('--theme-accent', colors.accent);
    root.style.setProperty('--theme-accent-hover', colors.accentHover);
    root.style.setProperty('--theme-success', colors.success);
    root.style.setProperty('--theme-warning', colors.warning);
    root.style.setProperty('--theme-error', colors.error);
    root.style.setProperty('--theme-info', colors.info);

    // Update body background color immediately
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;

    // Set data attribute for theme-based styling
    root.setAttribute('data-theme', preset);
    
    // Also update body class for Tailwind dark mode
    if (preset === 'dark' || preset === 'oled') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    console.log(`[Theme] Theme applied successfully. Colors:`, colors);
  }, [preset]);
  
  // Initial theme application on mount
  useEffect(() => {
    console.log(`[Theme] Initial mount, applying theme: ${preset}`);
    const colors = themePresets[preset];
    const root = document.documentElement;
    
    root.style.setProperty('--theme-bg', colors.background);
    root.style.setProperty('--theme-surface', colors.surface);
    root.style.setProperty('--theme-card', colors.card);
    root.style.setProperty('--theme-border', colors.border);
    root.style.setProperty('--theme-text', colors.text);
    root.style.setProperty('--theme-text-secondary', colors.textSecondary);
    root.style.setProperty('--theme-accent', colors.accent);
    root.style.setProperty('--theme-accent-hover', colors.accentHover);
    root.style.setProperty('--theme-success', colors.success);
    root.style.setProperty('--theme-warning', colors.warning);
    root.style.setProperty('--theme-error', colors.error);
    root.style.setProperty('--theme-info', colors.info);
    
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
    root.setAttribute('data-theme', preset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Apply font size
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  const colors = themePresets[preset];

  return (
    <ThemeContext.Provider
      value={{
        preset,
        colors,
        setPreset,
        fontSize,
        setFontSize,
        opacity,
        setOpacity,
        highContrast,
        setHighContrast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
