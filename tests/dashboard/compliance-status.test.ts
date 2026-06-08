import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateCoverage, listGaps } from '../../dashboard/compliance-status/app/compliance';
import type { ComplianceFramework } from '../../dashboard/compliance-status/app/types';

const framework: ComplianceFramework = {
  id: 'soc2',
  name: 'SOC 2',
  shortName: 'SOC2',
  description: 'Test framework',
  history: [],
  controls: [
    {
      id: 'covered',
      title: 'Covered control',
      requirement: 'Requirement',
      owner: 'Security',
      status: 'covered',
      evidence: { hasCryptographicProof: true },
      missing: [],
    },
    {
      id: 'partial',
      title: 'Partial control',
      requirement: 'Requirement',
      owner: 'Compliance',
      status: 'partial',
      evidence: { hasCryptographicProof: true },
      missing: ['Attach approval receipt'],
    },
    {
      id: 'gap',
      title: 'Gap control',
      requirement: 'Requirement',
      owner: 'Platform',
      status: 'gap',
      evidence: { hasCryptographicProof: false },
      missing: ['Add recovery test evidence'],
    },
  ],
};

describe('compliance status helpers', () => {
  it('calculates weighted coverage and proof coverage', () => {
    const coverage = calculateCoverage(framework.controls);

    assert.equal(coverage.covered, 1);
    assert.equal(coverage.partial, 1);
    assert.equal(coverage.gaps, 1);
    assert.equal(coverage.total, 3);
    assert.equal(coverage.weightedCoverage, 0.5);
    assert.equal(coverage.proofCoverage, 2 / 3);
  });

  it('lists partial and gap controls as missing work', () => {
    const gaps = listGaps(framework);

    assert.deepEqual(gaps.map((gap) => gap.controlId), ['partial', 'gap']);
    assert.deepEqual(gaps[0].missing, ['Attach approval receipt']);
    assert.deepEqual(gaps[1].missing, ['Add recovery test evidence']);
  });
});
