import assert from 'node:assert/strict';

import { dashboardRoutes, getRouteForPath } from './dashboard/navigation';

assert.deepEqual(
  dashboardRoutes.map((route) => route.label),
  ['Overview', 'Agents', 'Events', 'Cost', 'Security', 'Compliance', 'Settings'],
  'defines all requested dashboard navigation sections',
);

assert.deepEqual(
  dashboardRoutes.map((route) => route.path),
  ['/', '/agents', '/events', '/cost', '/security', '/compliance', '/settings'],
  'defines stable routes for every dashboard section',
);

assert.equal(getRouteForPath('/security').label, 'Security', 'resolves known route metadata');
assert.equal(getRouteForPath('/unknown').label, 'Overview', 'falls back to overview route metadata');

console.log('dashboard layout routes passed');
