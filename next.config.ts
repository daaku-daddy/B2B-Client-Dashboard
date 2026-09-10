import type { NextConfig } from 'next'

const config: NextConfig = {
  // Next 16 writes its own AGENTS.md/CLAUDE.md on `next dev` unless this is
  // off. This repo keeps a hand-written CLAUDE.md, which that would overwrite.
  agentRules: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image-transform.materialdepot.com' },
      { protocol: 'https', hostname: 'materialdepotimages.materialdepot.com' },
      { protocol: 'https', hostname: 'materialdepotimages.s3.ap-south-1.amazonaws.com' },
      { protocol: 'https', hostname: 'pub-132f3882c2074e84999a9ab982950552.r2.dev' },
      { protocol: 'https', hostname: 'palette.materialdepot.com' },
      { protocol: 'https', hostname: 'vmwvxwqzqxhwesjokztf.supabase.co' },
    ],
  },
}

export default config
