"use client";

import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";

type DemoCreateDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  description?: string;
};

/**
 * Demo-only create shell using CreateDrawer (ADR-013).
 * Replaces centered DemoActionDialog for order/deal/task/client stubs.
 */
export function DemoCreateDrawer({
  open,
  title,
  onClose,
  description = "Форма создания будет подключена к CRM API на следующем этапе. Сейчас интерфейс работает с локальными демонстрационными данными.",
}: DemoCreateDrawerProps) {
  return (
    <CreateDrawer
      open={open}
      title={title}
      description="Демо-режим"
      onClose={onClose}
      variant="overlay"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-portal-6">
          <div className="border-t border-portal-border pt-portal-5">
            <p className="text-portal-body leading-6 text-portal-muted">{description}</p>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" variant="primary" onClick={onClose}>
            Понятно
          </Button>
        </footer>
      </div>
    </CreateDrawer>
  );
}
