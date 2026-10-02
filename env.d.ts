// The Studio bundler inlines SANITY_STUDIO_* variables at build time.
declare const process: {env: Record<string, string | undefined>}
