import type { ComplianceFramework } from './types';

const HISTORY = {
  strong: [
    ['2026-01-01', 0.52],
    ['2026-02-01', 0.61],
    ['2026-03-01', 0.68],
    ['2026-04-01', 0.74],
    ['2026-05-01', 0.82],
    ['2026-06-01', 0.88],
  ],
  medium: [
    ['2026-01-01', 0.41],
    ['2026-02-01', 0.49],
    ['2026-03-01', 0.55],
    ['2026-04-01', 0.63],
    ['2026-05-01', 0.69],
    ['2026-06-01', 0.73],
  ],
  regulated: [
    ['2026-01-01', 0.48],
    ['2026-02-01', 0.58],
    ['2026-03-01', 0.64],
    ['2026-04-01', 0.71],
    ['2026-05-01', 0.79],
    ['2026-06-01', 0.84],
  ],
} as const;

export const FRAMEWORKS: ComplianceFramework[] = [
  {
    id: 'eu-ai-act',
    name: 'EU AI Act',
    shortName: 'EU AI Act',
    description: 'Risk classification, transparency, human oversight, and audit evidence for AI systems operating in the EU.',
    history: toHistory(HISTORY.strong),
    controls: [
      covered('Art. 9', 'Risk management system', 'Maintain a continuous AI risk management process.', 'Governance', 'teec-eu-risk-009'),
      covered('Art. 10', 'Training data governance', 'Document data quality, lineage, and bias controls.', 'Data', 'teec-eu-data-010'),
      partial('Art. 11', 'Technical documentation', 'Keep model, policy, and deployment documentation current.', 'Platform', ['Add model-card export to generated reports.']),
      covered('Art. 12', 'Record keeping', 'Retain logs and governance receipts for high-risk AI systems.', 'Security', 'teec-eu-logs-012'),
      partial('Art. 14', 'Human oversight', 'Define override, escalation, and approval workflows.', 'Operations', ['Attach signed approval evidence to manual overrides.']),
      gap('Art. 15', 'Accuracy and robustness', 'Track model drift, resilience, and cyber robustness metrics.', 'ML Platform', ['Add drift threshold evidence.', 'Add red-team summary receipts.']),
    ],
  },
  {
    id: 'soc2',
    name: 'SOC 2',
    shortName: 'SOC2',
    description: 'Trust Services Criteria coverage for security, availability, processing integrity, confidentiality, and privacy.',
    history: toHistory(HISTORY.regulated),
    controls: [
      covered('CC1.1', 'Control environment', 'Define governance ownership and accountability.', 'Compliance', 'teec-soc2-cc11'),
      covered('CC6.1', 'Logical access controls', 'Restrict access to policy and evidence stores.', 'Security', 'teec-soc2-cc61'),
      partial('CC7.2', 'Monitoring controls', 'Monitor governance events and anomalous activity.', 'Security', ['Connect alert acknowledgement receipts.']),
      covered('CC8.1', 'Change management', 'Track reviewed changes to policies and guardrails.', 'Platform', 'teec-soc2-cc81'),
      gap('A1.2', 'Availability recovery', 'Test service continuity and recovery procedures.', 'Operations', ['Add tabletop recovery evidence.', 'Add uptime SLO history.']),
    ],
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    shortName: 'HIPAA',
    description: 'Administrative, physical, and technical safeguards for workflows that may process protected health information.',
    history: toHistory(HISTORY.medium),
    controls: [
      covered('164.308(a)(1)', 'Security management process', 'Assess risks and manage security controls.', 'Security', 'teec-hipaa-risk'),
      partial('164.308(a)(3)', 'Workforce security', 'Ensure appropriate access and workforce authorization.', 'People', ['Add quarterly access attestation evidence.']),
      covered('164.312(a)', 'Access control', 'Enforce unique identity and least privilege.', 'Platform', 'teec-hipaa-access'),
      partial('164.312(b)', 'Audit controls', 'Record and review activity involving regulated data.', 'Compliance', ['Attach reviewer sign-off receipts.']),
      gap('164.312(e)', 'Transmission security', 'Protect regulated data in transit.', 'Infrastructure', ['Add encryption configuration proof.', 'Add PHI transport scan evidence.']),
    ],
  },
  {
    id: 'nist-ai-rmf',
    name: 'NIST AI RMF',
    shortName: 'NIST AI RMF',
    description: 'Map, measure, manage, and govern AI risks throughout the system lifecycle.',
    history: toHistory(HISTORY.strong),
    controls: [
      covered('GOVERN-1', 'Policies and accountability', 'AI risk management policies are defined and owned.', 'Governance', 'teec-nist-govern-1'),
      covered('MAP-2', 'Context and categorization', 'Deployment context and impacted users are documented.', 'Product', 'teec-nist-map-2'),
      partial('MEASURE-2', 'Performance monitoring', 'AI performance and reliability are measured over time.', 'ML Platform', ['Add weekly benchmark receipts.']),
      partial('MANAGE-1', 'Risk response', 'High-priority AI risks have tracked response plans.', 'Security', ['Link risk acceptance approvals.']),
      covered('GOVERN-5', 'Third-party risk', 'Provider and model vendor risks are tracked.', 'Compliance', 'teec-nist-govern-5'),
    ],
  },
  {
    id: 'iso-27001',
    name: 'ISO 27001',
    shortName: 'ISO 27001',
    description: 'Information security management controls relevant to AI governance infrastructure and evidence handling.',
    history: toHistory(HISTORY.regulated),
    controls: [
      covered('A.5.1', 'Information security policies', 'Security policies are approved and communicated.', 'Security', 'teec-iso-a51'),
      partial('A.5.23', 'Cloud service security', 'Cloud services are governed through security requirements.', 'Infrastructure', ['Add cloud provider control mapping.']),
      covered('A.8.15', 'Logging', 'Logs are retained and protected from tampering.', 'Platform', 'teec-iso-a815'),
      partial('A.8.16', 'Monitoring activities', 'Monitor systems for anomalous activity.', 'Security', ['Add alert closure evidence.']),
      gap('A.8.28', 'Secure coding', 'Secure development practices are defined and measured.', 'Engineering', ['Attach SAST trend evidence.', 'Add exception approval receipts.']),
    ],
  },
];

function covered(id: string, title: string, requirement: string, owner: string, proofId: string) {
  return {
    id,
    title,
    requirement,
    owner,
    status: 'covered' as const,
    evidence: {
      hasCryptographicProof: true,
      proofId,
      receiptHash: `sha256:${proofId.split('').map((char) => char.charCodeAt(0).toString(16)).join('').padEnd(64, '0').slice(0, 64)}`,
      updatedAt: '2026-05-31T15:20:00.000Z',
    },
    missing: [],
  };
}

function partial(id: string, title: string, requirement: string, owner: string, missing: string[]) {
  return {
    id,
    title,
    requirement,
    owner,
    status: 'partial' as const,
    evidence: {
      hasCryptographicProof: missing.length < 2,
      proofId: missing.length < 2 ? `teec-partial-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined,
      updatedAt: '2026-05-28T11:30:00.000Z',
    },
    missing,
  };
}

function gap(id: string, title: string, requirement: string, owner: string, missing: string[]) {
  return {
    id,
    title,
    requirement,
    owner,
    status: 'gap' as const,
    evidence: {
      hasCryptographicProof: false,
    },
    missing,
  };
}

function toHistory(points: readonly (readonly [string, number])[]) {
  return points.map(([date, coverage]) => ({ date, coverage }));
}
