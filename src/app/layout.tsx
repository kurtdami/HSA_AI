import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import "./globals.css";
import theme from "./theme";
import { AuthProvider } from "./authcontext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HSA AI - Receipt Scanner and Expense Tracker",
  description: "HSA AI Receipt Scanner and Expense Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
          <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <AuthProvider>
              {children}
              </AuthProvider>
          </ThemeProvider>
          </AppRouterCacheProvider>
       </body>
    </html>
  );
}
