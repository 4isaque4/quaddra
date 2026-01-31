import { ThemeProvider } from '@/contexts/ThemeContext';

export default function ValeShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider themeName="ValeShop">
      {children}
    </ThemeProvider>
  );
}
