export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold">Bursar</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Reads your supplier invoices, checks them, and pays them once a week after you approve the plan.
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">Setup in progress: the sample restaurant arrives in the next milestones.</p>
    </main>
  );
}
