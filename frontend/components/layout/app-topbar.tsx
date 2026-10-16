import { TopNavigation } from "@/components/navigation/top-navigation";
import type { AppSection } from "@/lib/navigation";

type AppTopbarProps = {
  sections?: AppSection[];
  debugMode?: boolean;
};

export function AppTopbar({ sections, debugMode = false }: AppTopbarProps) {
  return <TopNavigation sections={sections} debugMode={debugMode} />;
}
