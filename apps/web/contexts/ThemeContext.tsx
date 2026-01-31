'use client';
import React, { createContext, useContext, ReactNode } from 'react';

export type ThemeColors = {
  primary: string;
  primaryHover: string;
  secondary: string;
  secondaryHover: string;
  accent: string;
  accentHover: string;
  background: string;
  border: string;
  text: string;
  textSecondary: string;
};

export type Theme = {
  name: string;
  colors: ThemeColors;
};

const quaddraTheme: Theme = {
  name: 'Quaddra',
  colors: {
    primary: '#F29441',
    primaryHover: '#2D3340',
    secondary: '#2D3340',
    secondaryHover: '#606770',
    accent: '#F29441',
    accentHover: '#d97d2f',
    background: '#FFF9F5',
    border: '#F2CAA7',
    text: '#2D3340',
    textSecondary: '#606770',
  },
};

const valeshopTheme: Theme = {
  name: 'ValeShop',
  colors: {
    primary: '#0367A6',      // Azul ValeShop como primária
    primaryHover: '#0B3559',  // Azul escuro no hover
    secondary: '#D9961A',     // Dourado como secundária
    secondaryHover: '#F2CB05', // Amarelo no hover
    accent: '#F2CB05',        // Amarelo como accent
    accentHover: '#D9961A',   // Dourado no hover do accent
    background: '#FFF9E6',
    border: '#F2CB05',
    text: '#0B3559',
    textSecondary: '#0367A6',
  },
};

type ThemeContextType = {
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ 
  children, 
  themeName = 'Quaddra' 
}: { 
  children: ReactNode;
  themeName?: 'Quaddra' | 'ValeShop';
}) {
  const theme = themeName === 'ValeShop' ? valeshopTheme : quaddraTheme;

  return (
    <ThemeContext.Provider value={{ theme }}>
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
