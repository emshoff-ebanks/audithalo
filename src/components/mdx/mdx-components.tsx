import Link from "next/link";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import type { AnchorHTMLAttributes, ReactNode } from "react";

function MdxAnchor({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href?.startsWith("/")) {
    return (
      <Link href={href} className="text-[color:var(--ink-900)] underline decoration-[color:var(--halo-yellow)] decoration-2 underline-offset-2 hover:decoration-[color:var(--ink-900)]">
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[color:var(--ink-900)] underline decoration-[color:var(--halo-yellow)] decoration-2 underline-offset-2 hover:decoration-[color:var(--ink-900)]"
      {...rest}
    >
      {children}
    </a>
  );
}

export const mdxComponents: MDXRemoteProps["components"] = {
  h2: (props) => (
    <h2
      className="font-display text-2xl sm:text-3xl font-semibold text-foreground mt-12 mb-4 scroll-mt-24"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="font-display text-xl font-semibold text-foreground mt-8 mb-3 scroll-mt-24"
      {...props}
    />
  ),
  p: (props) => (
    <p className="text-[color:var(--ink-700)] leading-relaxed mb-5" {...props} />
  ),
  ul: (props) => (
    <ul
      className="list-disc pl-6 space-y-2 mb-5 text-[color:var(--ink-700)]"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="list-decimal pl-6 space-y-2 mb-5 text-[color:var(--ink-700)]"
      {...props}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: MdxAnchor,
  pre: (props) => (
    <pre
      className="mb-6 overflow-x-auto rounded-[10px] bg-[color:var(--ink-900)] p-4 text-sm leading-relaxed"
      {...props}
    />
  ),
  code: ({ className, ...props }: { className?: string }) => {
    // Fenced blocks arrive as <pre><code class="language-…">; inline code has
    // no language class. Block code inherits the dark <pre> surface; inline
    // code gets a subtle cream chip.
    const isBlock =
      typeof className === "string" && className.includes("language-");
    return (
      <code
        className={
          isBlock
            ? `${className} font-mono text-[color:var(--halo-yellow)]`
            : "rounded bg-[color:var(--paper-100)] px-1.5 py-0.5 font-mono text-[0.85em] text-[color:var(--ink-900)]"
        }
        {...props}
      />
    );
  },
  strong: (props) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  blockquote: (props: { children?: ReactNode }) => (
    <blockquote
      className="border-l-2 border-[color:var(--halo-yellow)] pl-4 italic text-[color:var(--ink-600)] mb-5"
      {...props}
    />
  ),
  hr: () => <hr className="border-[color:var(--ink-200)] my-10" />,
  table: (props) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  thead: (props) => <thead className="border-b border-[color:var(--ink-200)]" {...props} />,
  th: (props) => (
    <th
      className="text-left font-medium text-[color:var(--ink-500)] py-2 pr-4"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="py-2 pr-4 border-t border-[color:var(--ink-200)] text-[color:var(--ink-700)]"
      {...props}
    />
  ),
};
