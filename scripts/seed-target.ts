export type RemoteSeedEnvironment = 'development' | 'production';

export type RemoteSeedTarget = {
  environment: RemoteSeedEnvironment;
  ownerLinkFile: string;
  ownerLinkOrigin: string;
};

const REMOTE_SEED_TARGETS: Record<RemoteSeedEnvironment, Omit<RemoteSeedTarget, 'environment'>> = {
  development: {
    ownerLinkFile: '.local/neon-development-owner-path.txt',
    ownerLinkOrigin: '',
  },
  production: {
    ownerLinkFile: '.local/production-owner-link.txt',
    ownerLinkOrigin: 'https://museinvitehub.org',
  },
};

export function resolveRemoteSeedTarget(value: string | undefined): RemoteSeedTarget {
  if (value !== 'development' && value !== 'production') {
    throw new Error('Remote seed requires --environment development or --environment production.');
  }

  return { environment: value, ...REMOTE_SEED_TARGETS[value] };
}

export function ownerTokenFromSavedLink(value: string): string | null {
  const saved = value.trim();
  let path: string;

  if (saved.startsWith('/')) {
    path = saved;
  } else {
    try {
      const parsed = new URL(saved);
      if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
        return null;
      }
      if (parsed.search || parsed.hash) return null;
      path = parsed.pathname;
    } catch {
      return null;
    }
  }

  const match = /^\/manage\/([A-Za-z0-9_-]{43})$/.exec(path);
  return match?.[1] ?? null;
}
