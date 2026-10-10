import {
  Skeleton,
} from '@/components/ui/skeleton';

export default function AppLoading() {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="mx-auto max-w-7xl space-y-6"
    >
      <div
        className="space-y-2"
      >
        <Skeleton
          className="h-4 w-32"
        />

        <Skeleton
          className="h-8 w-48"
        />
      </div>

      <div
        className="space-y-3 rounded-xl border bg-background p-5"
      >
        {Array.from({
          length:
            6,
        }).map(
          (
            _,
            index,
          ) => (
            <Skeleton
              key={
                index
              }
              className="h-16 w-full"
            />
          ),
        )}
      </div>
    </div>
  );
}
