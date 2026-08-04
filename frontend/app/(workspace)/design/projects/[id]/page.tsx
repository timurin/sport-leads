import { notFound } from "next/navigation";

import { DesignProjectDetailWorkspace } from "@/components/design/design-project-detail-workspace";
import { PageLayout } from "@/components/layout/page-layout";
import { fetchDesignProject } from "@/lib/design/design-projects";

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

export default async function DesignProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const projectId = parseId(rawId);
  if (projectId == null) notFound();

  let project;
  try {
    project = await fetchDesignProject(projectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404") || message.toLowerCase().includes("не найден")) {
      notFound();
    }
    throw error;
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <DesignProjectDetailWorkspace project={project} />
    </PageLayout>
  );
}
