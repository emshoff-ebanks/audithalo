import { permanentRedirect } from "next/navigation";

// /for-practices was the original stub; the canonical page is now /for-group-practices.
// 308 permanent redirect preserves any existing inbound links + search rank.
export default function ForPracticesRedirect() {
  permanentRedirect("/for-group-practices");
}
