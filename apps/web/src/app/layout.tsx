"use client";

import { Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";

const hindSiliguri = Hind_Siliguri({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
  variable: "--font-hind-siliguri",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <title>KormoSync - কর্ম ট্র্যাকার</title>
        <meta name="description" content="KormoSync - বাংলায় কর্ম ট্র্যাকার" />
      </head>
      <body
        className={`${hindSiliguri.variable} antialiased`}
        style={{ fontFamily: "'Hind Siliguri', sans-serif" }}
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />
        </AuthProvider>
      </body>
    </html>
  );
}

