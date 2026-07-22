import { CatalogShellPlaceholder } from "@/components/settings/catalog-shell-placeholder";

type SizeGridCardRouteProps = {
  params: Promise<{ gridId: string }>;
};

export default async function SizeGridCardPlaceholderPage({
  params,
}: SizeGridCardRouteProps) {
  const { gridId } = await params;
  return (
    <CatalogShellPlaceholder
      catalogTitle="Карточка размерной сетки"
      description={`Маршрут карточки /settings/catalogs/size-grids/${gridId} зарезервирован. Данные и редактирование появятся в Stage 6.2.`}
    />
  );
}
