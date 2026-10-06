export const metadata = {
  title:
    'Workspace',
};

export default function AppHomePage() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-8"
    >
      <div>
        <p
          className="text-sm font-medium text-muted-foreground"
        >
          Workspace
        </p>

        <h1
          className="mt-1 text-2xl font-semibold tracking-tight"
        >
          Welcome to OpsDesk
        </h1>

        <p
          className="mt-2 max-w-2xl text-sm text-muted-foreground"
        >
          Manage customer conversations,
          tickets, and your support team
          from one workspace.
        </p>
      </div>

      <div
        className="flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-background p-8"
      >
        <div
          className="max-w-md text-center"
        >
          <h2
            className="font-medium"
          >
            Choose your workspace
          </h2>

          <p
            className="mt-2 text-sm text-muted-foreground"
          >
            Your organizations will
            appear here so you can
            select where you want to
            work.
          </p>
        </div>
      </div>
    </div>
  );
}