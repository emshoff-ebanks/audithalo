export type FaqItem = { q: string; a: string };

export function FaqSection({
  title = "Frequently asked questions",
  items,
}: {
  title?: string;
  items: FaqItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="border-t border-[color:var(--ink-200)] bg-[color:var(--paper-100)]">
      <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-8">
          {title}
        </h2>
        <div className="grid gap-3">
          {items.map((item, i) => (
            <details
              key={i}
              open={i === 0}
              className="group rounded-[10px] border border-[color:var(--ink-200)] bg-[color:var(--paper-white)] open:border-[color:var(--ink-400)]"
            >
              <summary className="mkt-faq-summary flex items-center justify-between gap-3 px-5 py-4 font-display text-[1.0625rem] font-semibold text-[color:var(--ink-900)]">
                {item.q}
                <span
                  className="mkt-faq-plus font-mono text-2xl leading-none text-[color:var(--halo-yellow)]"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <div className="border-t border-[color:var(--ink-100)] px-5 pb-4 pt-3 text-[color:var(--ink-600)] leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
