import { PageContent } from "@/components/layout/page-layout";

export default function OrderLoading() {
  return (
    <PageContent size="spacious">
      <div className="animate-pulse rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-5">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-4 h-8 w-2/3 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-48 rounded bg-slate-200" />
      </div>
    </PageContent>
  );
}
