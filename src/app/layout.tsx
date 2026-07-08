import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth/session";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Geneva Tax Declaration Assistant",
  description: "AI-assisted preparation of your Geneva personal tax declaration — not certified tax advice.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <NavBar session={session ? { email: session.email, role: session.role } : null} />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
