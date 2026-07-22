import { CatalogShellPlaceholder } from "@/components/settings/catalog-shell-placeholder";

type PatternSetCardRouteProps = {
  params: Promise<{ patternSetId: string }>;
};

export default async function PatternSetCardPlaceholderPage({
  params,
}: PatternSetCardRouteProps) {
  const { patternSetId } = await params;
  return (
    <CatalogShellPlaceholder
      catalogTitle="Карточка лекал"
      description={`Маршрут карточки /settings/catalogs/patterns/${patternSetId} зарезервирован. Данные и версии появятся в Stage 6.3.`}
    />
  );
}
