"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import { Loading } from "@/components/ui";

export default function Home() {
  const { me, ready } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    router.replace(!me ? "/sign-in" : me.onboardingComplete ? "/browse" : "/onboarding");
  }, [me, ready, router]);
  return <Loading />;
}
