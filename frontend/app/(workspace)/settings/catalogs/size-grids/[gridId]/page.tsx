import { notFound } from "next/navigation";

import { SizeGridCard } from "@/components/settings/size-grid-card";
import { getSizeGrid, parseSizeGridRouteId } from "@/lib/size-grids";

type SizeGridCardRouteProps = {
  params: Promise<{ gridId: string }>;
};

export default async function SizeGridCardPage({ params }: SizeGridCardRouteProps) {
  const { gridId: rawId } = await params;
  const gridId = parseSizeGridRouteId(rawId);
  if (gridId == null) notFound();

  const grid = await getSizeGrid(gridId);
  if (!grid) notFound();

  return <SizeGridCard grid={grid} />;
}
