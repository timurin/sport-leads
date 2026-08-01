import { TopNavigation } from "@/components/navigation/top-navigation";
import type { AppSection } from "@/lib/navigation";

type AppTopbarProps = {
  sections?: AppSection[];
};

export function AppTopbar({ sections }: AppTopbarProps) {
  return <TopNavigation sections={sections} />;
}
