import { describe, it, expect } from "vitest";
import { normalizeHtml } from "@/lib/rules/source-fetcher";

describe("normalizeHtml", () => {
  it("strips script tags", () => {
    expect(normalizeHtml("<p>hello</p><script>alert(1)</script>")).toBe(
      "hello"
    );
  });

  it("strips style tags", () => {
    expect(normalizeHtml("<style>.x{color:red}</style><p>text</p>")).toBe(
      "text"
    );
  });

  it("strips nav, header, footer", () => {
    const html =
      "<header><a>Home</a></header><main>Rule text</main><footer>Copyright</footer>";
    expect(normalizeHtml(html)).toBe("Rule text");
  });

  it("strips HTML comments", () => {
    expect(normalizeHtml("<!-- build 20260629 --><p>Rule</p>")).toBe("Rule");
  });

  it("strips all HTML tags", () => {
    expect(normalizeHtml('<div class="x"><span>A</span></div>')).toBe("A");
  });

  it("decodes common HTML entities", () => {
    expect(normalizeHtml("&amp; &lt; &gt; &quot; &#39; &apos; &nbsp;")).toBe(
      "& < > \" ' '"
    );
  });

  it("normalizes whitespace", () => {
    expect(normalizeHtml("<p>  hello   world  </p>")).toBe("hello world");
  });

  it("returns stable hash input for identical content with different chrome", () => {
    const v1 =
      '<nav><a href="/old-nav">Nav</a></nav><main><p>3000 hours required.</p></main>';
    const v2 =
      '<nav><a href="/new-nav">Updated Nav</a></nav><main><p>3000 hours required.</p></main>';
    expect(normalizeHtml(v1)).toBe(normalizeHtml(v2));
  });

  it("detects when main content changes", () => {
    const v1 = "<main><p>3000 hours required.</p></main>";
    const v2 = "<main><p>3100 hours required.</p></main>";
    expect(normalizeHtml(v1)).not.toBe(normalizeHtml(v2));
  });
});
