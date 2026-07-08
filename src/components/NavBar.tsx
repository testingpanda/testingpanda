import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export function NavBar({ session }: { session: { email: string; role: string } | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/cases" className="font-semibold text-brand-700">
          Geneva Tax Assistant
        </Link>
        {session && (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/cases" className="text-slate-600 hover:text-slate-900">
              My cases
            </Link>
            <Link href="/settings" className="text-slate-600 hover:text-slate-900">
              Settings
            </Link>
            {session.role === "ADMIN" && (
              <Link href="/admin" className="text-slate-600 hover:text-slate-900">
                Admin
              </Link>
            )}
            <span className="text-slate-400">{session.email}</span>
            <LogoutButton />
          </nav>
        )}
      </div>
    </header>
  );
}
