import { COPY } from "../copy";

export function AudienceStrip({
  onRegisterClick,
}: {
  onRegisterClick: () => void;
}) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16 w-full grid sm:grid-cols-2 gap-6">
      <div className="rounded-3xl border-2 border-border/80 bg-card p-6 shadow-soft flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold text-foreground">
          👨‍👩‍👧 {COPY.parentTitle}
        </h3>
        <p className="text-sm text-muted-foreground flex-1">
          {COPY.parentBody}
        </p>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border-2 border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary cursor-pointer self-start"
          onClick={onRegisterClick}
        >
          {COPY.parentCta}
        </button>
      </div>
      <div className="rounded-3xl border-2 border-border/80 bg-card p-6 shadow-soft flex flex-col gap-3">
        <h3 className="font-display text-lg font-bold text-foreground">
          🧑‍🏫 {COPY.teacherTitle}
        </h3>
        <p className="text-sm text-muted-foreground flex-1">
          {COPY.teacherBody}
        </p>
        <a
          className="inline-flex items-center justify-center rounded-xl border-2 border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary cursor-pointer self-start no-underline"
          href="/gioi-thieu"
        >
          {COPY.teacherCta}
        </a>
      </div>
    </section>
  );
}
