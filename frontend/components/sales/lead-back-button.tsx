"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LeadBackButton() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/sales/leads");
  }

  return (
    <Button type="button" onClick={goBack} className="px-3">
      <ArrowLeft size={16} />
      <span className="hidden sm:inline">К списку лидов</span>
      <span className="sm:hidden">Назад</span>
    </Button>
  );
}
