import { getAllDocs } from "@/lib/docs";
import { buildDocsNav, buildSearchIndex } from "@/lib/docs-nav";
import { DocsSidebar } from "@/components/marketing/docs-sidebar";
import { DocsSearch } from "@/components/marketing/docs-search";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = getAllDocs();
  const nav = buildDocsNav(docs);
  const index = buildSearchIndex(docs);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
      <div className="mb-8 max-w-md">
        <DocsSearch index={index} />
      </div>
      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-12">
        <aside>
          <DocsSidebar nav={nav} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
