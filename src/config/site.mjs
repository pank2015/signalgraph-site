/** Site-wide settings the curator may edit. */
export const SITE = {
  title: "Signalgraph",
  tagline: "Grounded signal on AI, quantum, and the systems underneath.",
  motto: "No claim without a source.",
};

/**
 * giscus comments — OFF until the curator installs the giscus app on this
 * repo (https://github.com/apps/giscus), enables Discussions, and fills the
 * ids from https://giscus.app. The component renders nothing while disabled.
 */
export const GISCUS = {
  enabled: false,
  repo: "pank2015/signalgraph-site",
  repoId: "",        // from giscus.app
  category: "Posts",
  categoryId: "",    // from giscus.app
};
