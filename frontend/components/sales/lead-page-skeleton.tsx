import { PageContent, ResponsiveGrid } from "@/components/layout/page-layout";

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

function WorkCardSkeleton() {
  return (
    <div className="rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-3 shadow-[var(--portal-shadow-card)]">
      <SkeletonLine className="w-36" />
      <div className="mt-4 space-y-4">{[0, 1, 2, 3].map((item) => <div key={item} className="border-b border-slate-100 pb-3"><SkeletonLine className="w-4/5" /><SkeletonLine className="mt-2 h-3 w-2/3" /></div>)}</div>
    </div>
  );
}

function CommunicationSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]">
      <div className="p-3.5"><SkeletonLine className="w-36" /><SkeletonLine className="mt-2 w-64 max-w-full" /><div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">{[0, 1, 2, 3, 4, 5, 6].map((item) => <SkeletonLine key={item} className="h-14 w-full" />)}</div></div>
      <div className="lead-communication-body grid">
        <div className="lead-client-summary border-b border-slate-200 p-3.5"><SkeletonLine className="w-28" />{[0, 1, 2, 3].map((item) => <div key={item} className="mt-5"><SkeletonLine className="h-3 w-24" /><SkeletonLine className="mt-2 w-20" /></div>)}</div>
        <div><div className="h-[430px] space-y-3 bg-slate-50 p-4">{["w-3/5", "w-2/3", "w-1/2", "w-3/4"].map((width, index) => <div key={width} className={`rounded-lg bg-white p-3 shadow-sm ${index % 2 ? "ml-auto" : ""} ${width}`}><SkeletonLine className="w-24" /><SkeletonLine className="mt-2 w-full" /></div>)}</div><div className="border-t border-slate-200 p-3"><SkeletonLine className="h-20 w-full" /><div className="mt-3 flex gap-2"><SkeletonLine className="h-10 w-28" /><SkeletonLine className="ml-auto h-10 w-28" /></div></div></div>
      </div>
    </div>
  );
}

export function LeadPageSkeleton() {
  return (
    <div data-lead-workspace className="w-full min-w-0 bg-portal-page" aria-busy="true" aria-label="Загрузка лида">
      <div className="border-b border-portal-border bg-portal-surface">
        <PageContent size="compact" width="full">
          <div className="flex items-center gap-2"><SkeletonLine className="h-9 w-28" /><SkeletonLine className="w-16" /><SkeletonLine className="ml-auto h-9 w-20" /></div>
          <div className="mt-2 flex items-start justify-between gap-4"><div><div className="flex gap-3"><SkeletonLine className="h-7 w-40" /><SkeletonLine className="h-6 w-24 rounded-full" /></div><SkeletonLine className="mt-2 w-72 max-w-full" /></div><div className="flex gap-2"><SkeletonLine className="h-9 w-24" /><SkeletonLine className="h-9 w-28" /><SkeletonLine className="h-9 w-20" /></div></div>
          <div className="mt-3 flex overflow-hidden rounded-lg">{[0, 1, 2, 3, 4].map((item) => <SkeletonLine key={item} className="h-9 min-w-32 flex-1 rounded-none" />)}</div>
        </PageContent>
      </div>

      <PageContent size="compact" width="full" className="lead-page-container">
        <div className="lead-main-grid grid min-w-0 gap-4">
          <div className="lead-left-column min-w-0 space-y-3">
            <SkeletonLine className="w-56" />
            <ResponsiveGrid minItemWidth="large" className="lead-reference-grid"><DataCardSkeleton /><DataCardSkeleton /></ResponsiveGrid>
            <div className="rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-3 shadow-[var(--portal-shadow-card)]"><SkeletonLine className="w-40" /><ResponsiveGrid minItemWidth="small" gap="compact" className="lead-metrics-grid mt-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface-secondary p-3"><SkeletonLine className="h-3 w-20" /><SkeletonLine className="mt-2 h-5 w-24 max-w-full" /></div>)}</ResponsiveGrid></div>
            <div className="lead-bottom-grid grid gap-3"><WorkCardSkeleton /><WorkCardSkeleton /><WorkCardSkeleton /></div>
          </div>
          <CommunicationSkeleton />
        </div>
      </PageContent>
    </div>
  );
}
