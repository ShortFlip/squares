import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old card editor at /create was retired once the Item Library replaced
  // it. Old bookmarks and links still land somewhere useful: an edit link
  // (/create?id=<templateId>) opens that same card in the library's card pane,
  // since library cards are the same card_templates rows and /library reads
  // ?card=<id>. Anything else goes to the library itself. Rules match in order,
  // so the ?id= rule must come first. Next passes the request's own query
  // through as well, so the first rule lands on /library?id=<x>&card=<x>; the
  // library page drops both params with router.replace once the card loads.
  async redirects() {
    return [
      {
        source: "/create",
        has: [{ type: "query", key: "id", value: "(?<id>.+)" }],
        destination: "/library?card=:id",
        permanent: true,
      },
      {
        source: "/create",
        destination: "/library",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
