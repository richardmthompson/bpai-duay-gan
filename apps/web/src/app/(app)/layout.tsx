"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import { BottomNav } from "@/components/BottomNav";
import { Loading } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, ready } = useApp();
  const router = useRouter();
  const allowed = ready && me?.onboardingComplete;

  useEffect(() => {
    if (!ready) return;
    if (!me) router.replace("/sign-in");
    else if (!me.onboardingComplete) router.replace("/onboarding");
  }, [me, ready, router]);

  if (!allowed) return <Loading />;
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {children}
      <BottomNav />
    </div>
  );
}
