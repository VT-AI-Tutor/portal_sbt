import { COPY } from "../copy";

export function FinalCta({ onClick }: { onClick: () => void }) {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-16 w-full">
      <div className="rounded-3xl bg-gradient-to-r from-primary to-fun px-6 py-12 text-center shadow-soft">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-6">
          {COPY.finalTitle}
        </h2>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary shadow-soft transition hover:opacity-90 cursor-pointer"
          onClick={onClick}
        >
          {COPY.finalCta}
        </button>
      </div>
    </section>
  );
}
