"use client";

import { useEffect } from "react";
import { Chooser } from "@/components/chooser";

export default function HomePage() {
  useEffect(() => {
    document.body.classList.add("chooser-lock");
    return () => document.body.classList.remove("chooser-lock");
  }, []);

  return <Chooser />;
}
