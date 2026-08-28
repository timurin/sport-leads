"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

type SettingsHubLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  children: ReactNode;
};

/**
 * Hub tiles inside `@settingsSlider/(.)settings` must leave soft-nav intercept
 * with a full navigation — otherwise URL updates but the slider stays on top
 * (`26.9.4`). Hard refresh / deep link of `/settings` is a normal full page;
 * plain Link is fine there.
 */
export function SettingsHubLink({
  href,
  children,
  onClick,
  ...props
}: SettingsHubLinkProps) {
  const leaveSlider = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (typeof document === "undefined") return;
    if (!event.currentTarget.closest("[data-settings-card-slider]")) return;
    event.preventDefault();
    window.location.assign(href);
  };

  return (
    <Link href={href} {...props} onClick={leaveSlider} data-settings-hub-link>
      {children}
    </Link>
  );
}
