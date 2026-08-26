import { PageContent } from "@/components/layout/page-layout";

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`h-4 animate-pulse rounded bg-slate-200 ${className}`} />;
}

function DataCardSkeleton() {
  return (
    <div className="rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-3.5 shadow-[var(--portal-shadow-card)]">
      <div className="flex items-center justify-between"><SkeletonLine className="w-40" /><SkeletonLine className="h-8 w-24" /></div>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
        {[0, 1, 2, 3, 4, 5].map((item) => <div key={item}><SkeletonLine className="h-3 w-20" /><SkeletonLine className="mt-2 w-3/4" /></div>)}
      </div>
    </div>
  );
}

function CommunicationSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]">
      <div className="p-3.5"><SkeletonLine className="w-36" /><SkeletonLine className="mt-2 w-64 max-w-full" /><div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">{[0, 1, 2, 3, 4, 5, 6].map((item) => <SkeletonLine key={item} className="h-14 w-full" />)}</div></div>
      <div className="min-w-0">
        <div><div className="h-[430px] space-y-3 bg-slate-50 p-4">{["w-3/5", "w-2/3", "w-1/2", "w-3/4"].map((width, index) => <div key={width} className={`rounded-lg bg-white p-3 shadow-sm ${index % 2 ? "ml-auto" : ""} ${width}`}><SkeletonLine className="w-24" /><SkeletonLine className="mt-2 w-full" /></div>)}</div><div className="border-t border-slate-200 p-3"><SkeletonLine className="h-20 w-full" /><div className="mt-3 flex gap-2"><SkeletonLine className="h-10 w-28" /><SkeletonLine className="ml-auto h-10 w-28" /></div></div></div>
      </div>
    </div>
  );
}

export function LeadPageSkeleton() {
  return (
    <div data-lead-workspace data-complex-entity-card-page className="sl-design-v1 w-full min-w-0 bg-portal-page text-portal-text">
      <div className="border-b border-portal-border bg-portal-surface p-4"><SkeletonLine className="w-64" /><SkeletonLine className="mt-3 h-8 w-full max-w-xl" /></div>
      <PageContent size="compact" width="full" className="lead-page-container">
        <div className="lead-main-grid grid min-w-0 gap-4">
          <div className="lead-left-column min-w-0 space-y-3">
            <div className="flex gap-2"><SkeletonLine className="h-7 w-28" /><SkeletonLine className="h-7 w-40" /><SkeletonLine className="h-7 w-24" /></div>
            <DataCardSkeleton />
            <DataCardSkeleton />
          </div>
          <CommunicationSkeleton />
        </div>
      </PageContent>
    </div>
  );
}
