"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import "../app.css";
import { Dashboard } from "@/components/dashboard";

export default function DashboardPage() {
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("upgraded") === "1") {
      // Clean the URL without a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      window.history.replaceState({}, "", url.toString());
    }
  }, [params]);

  return <Dashboard upgradedFromStripe={params.get("upgraded") === "1"} />;
}
