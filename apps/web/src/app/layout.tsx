import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Encabezado } from "@/componentes/Encabezado";
import { ProveedorSesion } from "@/lib/sesion";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kromatica · Cotizaciones",
  description: "Cálculo de costos y precios de productos personalizados en PVC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ProveedorSesion>
          <Encabezado />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        </ProveedorSesion>
      </body>
    </html>
  );
}
