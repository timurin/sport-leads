export const uiTokens = {
  layout: {
    sidebarWidth: 92,
    topNavigationHeight: 72,
    workspaceTabsHeight: 44,
    contentMaxWidth: 1800,
  },

  radius: {
    small: "rounded-lg",
    medium: "rounded-xl",
    large: "rounded-2xl",
  },

  shadow: {
    card: "shadow-sm",
    dropdown:
      "shadow-[0_18px_45px_rgba(15,23,42,0.18)]",
    overlay:
      "shadow-[0_24px_80px_rgba(15,23,42,0.25)]",
  },

  status: {
    new: {
      label: "Новый",
      dot: "bg-blue-500",
      badge: "bg-blue-50 text-blue-700",
    },
    progress: {
      label: "В работе",
      dot: "bg-amber-500",
      badge: "bg-amber-50 text-amber-700",
    },
    success: {
      label: "Выполнено",
      dot: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700",
    },
    danger: {
      label: "Просрочено",
      dot: "bg-red-500",
      badge: "bg-red-50 text-red-700",
    },
  },
} as const;