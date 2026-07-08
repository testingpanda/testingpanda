"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/apiFetch";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await apiFetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
