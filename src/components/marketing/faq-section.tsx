import { Card, CardContent } from "@/components/ui/card";

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
        <div className="space-y-4">
          {items.map((item, i) => (
            <Card
              key={i}
              className="rounded-[14px] border-[color:var(--ink-200)] bg-[color:var(--paper-white)]"
            >
              <CardContent className="p-6">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {item.q}
                </h3>
                <p className="mt-2 text-[color:var(--ink-600)] leading-relaxed">
                  {item.a}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
