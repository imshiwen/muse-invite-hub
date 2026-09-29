import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerTokenFromSavedLink, resolveRemoteSeedTarget } from '../scripts/seed-target';

test('remote seed environments use separate owner-link files and origins', () => {
  const development = resolveRemoteSeedTarget('development');
  const production = resolveRemoteSeedTarget('production');

  assert.equal(development.ownerLinkFile, '.local/neon-development-owner-path.txt');
  assert.equal(development.ownerLinkOrigin, '');
  assert.equal(production.ownerLinkFile, '.local/production-owner-link.txt');
  assert.equal(production.ownerLinkOrigin, 'https://museinvitehub.org');
  assert.notEqual(development.ownerLinkFile, production.ownerLinkFile);
});

test('remote seed requires an explicit supported environment', () => {
  assert.throws(() => resolveRemoteSeedTarget(undefined), /--environment development/);
  assert.throws(() => resolveRemoteSeedTarget('staging'), /--environment development/);
});

test('saved relative management paths and existing full links yield the same token', () => {
  const token = 'a'.repeat(43);

  assert.equal(ownerTokenFromSavedLink(`/manage/${token}`), token);
  assert.equal(ownerTokenFromSavedLink(`https://museinvitehub.org/manage/${token}`), token);
  assert.equal(ownerTokenFromSavedLink(`/other/${token}`), null);
});
