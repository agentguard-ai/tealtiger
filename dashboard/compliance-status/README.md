# Compliance Status Dashboard

React dashboard view for compliance coverage, evidence status, and gap analysis across AI governance frameworks.

## Run locally

```sh
npm run dashboard:compliance:dev
```

## Build

```sh
npm run dashboard:compliance:build
```

## Included views

- Framework selector for EU AI Act, SOC2, HIPAA, NIST AI RMF, and ISO 27001
- Per-control checklist with Covered, Partial, and Gap statuses
- Weighted coverage and cryptographic evidence coverage summaries
- Native SVG compliance timeline
- Gap analysis for missing controls and evidence
- Report generation button that POSTs to `/api/compliance/reports`
