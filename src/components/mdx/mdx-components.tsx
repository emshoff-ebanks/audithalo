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
      <Link href={href} className="text-secondary underline underline-offset-2">
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-secondary underline underline-offset-2"
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
    <p className="text-foreground/80 leading-relaxed mb-5" {...props} />
  ),
  ul: (props) => (
    <ul
      className="list-disc pl-6 space-y-2 mb-5 text-foreground/80"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="list-decimal pl-6 space-y-2 mb-5 text-foreground/80"
      {...props}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: MdxAnchor,
  strong: (props) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  blockquote: (props: { children?: ReactNode }) => (
    <blockquote
      className="border-l-2 border-secondary pl-4 italic text-foreground/70 mb-5"
      {...props}
    />
  ),
  hr: () => <hr className="border-border my-10" />,
  table: (props) => (
    <div className="mb-6 overflow-x-auto">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  thead: (props) => <thead className="border-b border-border" {...props} />,
  th: (props) => (
    <th
      className="text-left font-medium text-foreground/60 py-2 pr-4"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="py-2 pr-4 border-t border-border text-foreground/80"
      {...props}
    />
  ),
};
