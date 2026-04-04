# Requirements Document: CI/CD and IaC Integration Artifacts for TealTiger v1.1.x

## Introduction

This document specifies the requirements for creating the actual CI/CD integration artifacts and Infrastructure-as-Code modules for TealTiger v1.1.x. While the launch pipeline (CICDPublisher, IaCPublisher) already handles publishing these artifacts to registries, the artifacts themselves do not yet exist. This spec covers the creation of: a GitHub Action for GitHub Marketplace, a GitLab CI reusable template, a CircleCI Orb, a Terraform module for deploying TealTiger infrastructure, and a Helm chart for Kubernetes deployments. Each artifact runs TealTiger security scans (PII detection, prompt injection, content moderation) and policy tests, or deploys TealTiger as infrastructure.

## Glossary

- **GitHub_Action**: A composite or Docker-based GitHub Action published to GitHub Marketplace that runs TealTiger guardrails and policy tests in GitHub Actions CI pipelines
- **GitLab_CI_Template**: A reusable `.gitlab-ci.yml` template that runs TealTiger security scans in GitLab CI/CD pipelines
- **CircleCI_Orb**: A reusable CircleCI orb package that runs TealTiger security scans in CircleCI pipelines
- **Terraform_Module**: A Terraform module for deploying TealTiger as infrastructure (Lambda layers, container deployments, ECS/Fargate services)
- **Helm_Chart**: A Kubernetes Helm chart for deploying TealTiger as a sidecar container or standalone service
- **Security_Scan**: The execution of TealTiger guardrails (PII detection, prompt injection detection, content moderation) against a target corpus or prompt set
- **Policy_Test**: The execution of TealTiger policy test harness against a policy configuration to verify expected allow/deny decisions
- **Scan_Report**: A structured output (JSON, JUnit XML, or SARIF) summarizing the results of a Security_Scan or Policy_Test run
- **TealTiger_Docker_Image**: The official TealTiger Docker image at `tealtigeradmin/tealtiger-docker` (Docker Hub) or `ghcr.io/agentguard-ai/tealtiger` (GHCR)
- **Guardrail_Engine**: The TealTiger component that orchestrates PII detection, prompt injection detection, and content moderation guardrails
- **Policy_Tester**: The TealTiger component that runs policy test suites and generates pass/fail reports
- **Scan_Configuration**: A user-provided configuration file specifying which guardrails to enable, sensitivity levels, and custom patterns

## Requirements

### Requirement 1: GitHub Action for GitHub Marketplace

**User Story:** As a developer using GitHub Actions, I want a TealTiger security scan action available on GitHub Marketplace, so that I can add AI security guardrails and policy tests to my CI pipeline with a single `uses:` step.

#### Acceptance Criteria

1. THE GitHub_Action SHALL be defined as a Docker-based action using the TealTiger_Docker_Image as its runtime
2. THE GitHub_Action SHALL accept an `scan-path` input specifying the directory or file glob containing prompts or text to scan
3. THE GitHub_Action SHALL accept a `guardrails` input specifying a comma-separated list of guardrails to enable (pii, prompt-injection, content-moderation)
4. THE GitHub_Action SHALL accept a `policy-file` input specifying the path to a TealTiger policy configuration file for policy testing
5. THE GitHub_Action SHALL accept a `sensitivity` input with values low, medium, or high, defaulting to medium
6. THE GitHub_Action SHALL accept a `fail-on-finding` input (boolean, default true) that controls whether the action fails the workflow when a guardrail violation is detected
7. THE GitHub_Action SHALL accept a `report-format` input with values json, junit, or sarif, defaulting to json
8. WHEN the GitHub_Action executes, THE GitHub_Action SHALL run the Guardrail_Engine against all files matching the `scan-path` input
9. WHEN a `policy-file` input is provided, THE GitHub_Action SHALL run the Policy_Tester against the specified policy configuration
10. WHEN the scan completes, THE GitHub_Action SHALL produce a Scan_Report as a GitHub Actions output and write the report file to the workspace
11. WHEN `fail-on-finding` is true and a guardrail violation is detected, THE GitHub_Action SHALL exit with a non-zero exit code
12. WHEN `report-format` is sarif, THE GitHub_Action SHALL produce a report compatible with GitHub Code Scanning
13. THE GitHub_Action SHALL include an `action.yml` metadata file with name "TealTiger Security Scan", branding icon and color, and all input/output definitions
14. THE GitHub_Action SHALL include a README.md with usage examples, input/output documentation, and a quickstart workflow snippet
15. THE GitHub_Action SHALL be licensed under Apache 2.0

### Requirement 2: GitLab CI Reusable Template

**User Story:** As a developer using GitLab CI/CD, I want a reusable TealTiger CI template, so that I can include TealTiger security scans in my GitLab pipelines with a single `include:` directive.

#### Acceptance Criteria

1. THE GitLab_CI_Template SHALL be defined as a reusable `.gitlab-ci.yml` file using the `include:` mechanism
2. THE GitLab_CI_Template SHALL use the TealTiger_Docker_Image as the job image
3. THE GitLab_CI_Template SHALL define a `tealtiger-scan` job that runs TealTiger guardrails against a configurable scan path
4. THE GitLab_CI_Template SHALL define a `tealtiger-policy-test` job that runs TealTiger policy tests against a configurable policy file
5. THE GitLab_CI_Template SHALL accept CI/CD variables `TEALTIGER_SCAN_PATH`, `TEALTIGER_GUARDRAILS`, `TEALTIGER_SENSITIVITY`, `TEALTIGER_POLICY_FILE`, and `TEALTIGER_FAIL_ON_FINDING` for configuration
6. WHEN the `tealtiger-scan` job completes, THE GitLab_CI_Template SHALL produce a JUnit report artifact for GitLab test reporting integration
7. WHEN the `tealtiger-scan` job completes, THE GitLab_CI_Template SHALL produce a Code Quality report artifact compatible with GitLab Code Quality
8. THE GitLab_CI_Template SHALL place scan and policy-test jobs in a `test` stage by default
9. THE GitLab_CI_Template SHALL include a README.md with usage examples and variable documentation
10. THE GitLab_CI_Template SHALL be licensed under Apache 2.0

### Requirement 3: CircleCI Orb

**User Story:** As a developer using CircleCI, I want a TealTiger orb, so that I can add TealTiger security scans to my CircleCI pipelines using a reusable orb command.

#### Acceptance Criteria

1. THE CircleCI_Orb SHALL be defined as a valid CircleCI orb YAML file following the CircleCI orb authoring specification
2. THE CircleCI_Orb SHALL define a `scan` command that runs TealTiger guardrails against a configurable scan path
3. THE CircleCI_Orb SHALL define a `policy-test` command that runs TealTiger policy tests against a configurable policy file
4. THE CircleCI_Orb SHALL define a `full-scan` job that combines the `scan` and `policy-test` commands into a single job using the TealTiger_Docker_Image as executor
5. THE CircleCI_Orb SHALL accept parameters `scan-path`, `guardrails`, `sensitivity`, `policy-file`, `fail-on-finding`, and `report-format` matching the GitHub_Action input semantics
6. WHEN the `scan` command completes, THE CircleCI_Orb SHALL store the Scan_Report as a CircleCI test result artifact
7. WHEN the `scan` command completes, THE CircleCI_Orb SHALL store the Scan_Report using the `store_test_results` step for CircleCI test insights integration
8. THE CircleCI_Orb SHALL define an executor named `tealtiger` using the TealTiger_Docker_Image
9. THE CircleCI_Orb SHALL include inline usage examples in the orb metadata
10. THE CircleCI_Orb SHALL be licensed under Apache 2.0

### Requirement 4: Terraform Module

**User Story:** As a platform engineer, I want a Terraform module for deploying TealTiger, so that I can provision TealTiger infrastructure (Lambda layers, ECS containers) using standard Terraform workflows.

#### Acceptance Criteria

1. THE Terraform_Module SHALL define a root module with submodules for `lambda-layer`, `ecs-service`, and `container-deployment`
2. THE Terraform_Module SHALL accept a `tealtiger_version` variable specifying the TealTiger SDK version to deploy, defaulting to the latest published version
3. WHEN the `lambda-layer` submodule is applied, THE Terraform_Module SHALL create an AWS Lambda layer containing the TealTiger SDK for the specified runtime (nodejs20.x or python3.12)
4. WHEN the `ecs-service` submodule is applied, THE Terraform_Module SHALL create an ECS Fargate service running the TealTiger_Docker_Image
5. WHEN the `container-deployment` submodule is applied, THE Terraform_Module SHALL create a generic container deployment using the TealTiger_Docker_Image with configurable environment variables
6. THE Terraform_Module SHALL accept a `guardrails` variable specifying which guardrails to enable in the deployed TealTiger instance
7. THE Terraform_Module SHALL accept a `policy_file_path` variable specifying the path to a policy configuration file to include in the deployment
8. THE Terraform_Module SHALL output the deployed resource identifiers (Lambda layer ARN, ECS service ARN, or container endpoint URL)
9. THE Terraform_Module SHALL include a `versions.tf` file requiring Terraform 1.5 or later and AWS provider 5.0 or later
10. THE Terraform_Module SHALL include a README.md with usage examples for each submodule, input/output documentation, and prerequisite instructions
11. THE Terraform_Module SHALL be licensed under Apache 2.0
12. THE Terraform_Module SHALL include example `.tfvars` files for common deployment scenarios

### Requirement 5: Helm Chart for Kubernetes

**User Story:** As a Kubernetes operator, I want a Helm chart for deploying TealTiger, so that I can deploy TealTiger as a sidecar or standalone service in my Kubernetes cluster.

#### Acceptance Criteria

1. THE Helm_Chart SHALL define a valid Helm v3 chart with a `Chart.yaml`, `values.yaml`, and template files
2. THE Helm_Chart SHALL support a `standalone` deployment mode that creates a Deployment and Service for TealTiger as an independent service
3. THE Helm_Chart SHALL support a `sidecar` deployment mode that injects TealTiger as a sidecar container into an existing workload via a configurable pod template
4. THE Helm_Chart SHALL use the TealTiger_Docker_Image as the default container image, configurable via `image.repository` and `image.tag` values
5. THE Helm_Chart SHALL accept `guardrails.enabled` values (pii, promptInjection, contentModeration) to configure which guardrails are active
6. THE Helm_Chart SHALL accept a `policyConfig` value for mounting a TealTiger policy configuration as a ConfigMap
7. THE Helm_Chart SHALL include a `ServiceAccount`, `ConfigMap`, and optional `Ingress` resource in the templates
8. THE Helm_Chart SHALL include configurable resource requests and limits with sensible defaults (128Mi memory request, 256Mi limit)
9. THE Helm_Chart SHALL include liveness and readiness probes for the TealTiger container
10. THE Helm_Chart SHALL include a `values.schema.json` file validating all chart values
11. THE Helm_Chart SHALL include a README.md with installation instructions, configuration reference, and example values for standalone and sidecar modes
12. THE Helm_Chart SHALL include a NOTES.txt template that prints post-installation instructions
13. THE Helm_Chart SHALL be licensed under Apache 2.0
14. THE Helm_Chart SHALL pass `helm lint` validation without errors or warnings

### Requirement 6: Shared Scan Entrypoint Script

**User Story:** As a maintainer, I want a single entrypoint script that all CI/CD integrations invoke, so that scan logic is consistent across GitHub Actions, GitLab CI, and CircleCI.

#### Acceptance Criteria

1. THE GitHub_Action, GitLab_CI_Template, and CircleCI_Orb SHALL invoke a shared entrypoint script (`tealtiger-scan.sh`) for executing scans
2. THE entrypoint script SHALL accept environment variables `TEALTIGER_SCAN_PATH`, `TEALTIGER_GUARDRAILS`, `TEALTIGER_SENSITIVITY`, `TEALTIGER_POLICY_FILE`, `TEALTIGER_FAIL_ON_FINDING`, and `TEALTIGER_REPORT_FORMAT` for configuration
3. WHEN `TEALTIGER_GUARDRAILS` is not set, THE entrypoint script SHALL enable all guardrails (pii, prompt-injection, content-moderation) by default
4. WHEN `TEALTIGER_SENSITIVITY` is not set, THE entrypoint script SHALL use medium sensitivity by default
5. WHEN `TEALTIGER_FAIL_ON_FINDING` is not set, THE entrypoint script SHALL default to true (fail on finding)
6. WHEN `TEALTIGER_REPORT_FORMAT` is not set, THE entrypoint script SHALL default to json format
7. WHEN the scan detects violations and `TEALTIGER_FAIL_ON_FINDING` is true, THE entrypoint script SHALL exit with exit code 1
8. WHEN the scan detects no violations, THE entrypoint script SHALL exit with exit code 0
9. THE entrypoint script SHALL write the Scan_Report to a file at a configurable output path (default: `./tealtiger-report`)
10. IF the `TEALTIGER_SCAN_PATH` does not exist or is empty, THEN THE entrypoint script SHALL exit with exit code 2 and a descriptive error message

### Requirement 7: Integration Documentation and Examples

**User Story:** As a developer evaluating TealTiger, I want clear documentation and working examples for each integration, so that I can quickly adopt TealTiger in my CI/CD pipeline or infrastructure.

#### Acceptance Criteria

1. THE GitHub_Action SHALL include an `examples/` directory with at least two complete workflow files: a basic scan workflow and an advanced workflow with policy testing and SARIF upload
2. THE GitLab_CI_Template SHALL include an `examples/` directory with at least two complete pipeline files: a basic scan pipeline and an advanced pipeline with policy testing and Code Quality reporting
3. THE CircleCI_Orb SHALL include inline usage examples in the orb metadata covering basic scan and policy test scenarios
4. THE Terraform_Module SHALL include an `examples/` directory with at least three complete configurations: Lambda layer deployment, ECS service deployment, and container deployment
5. THE Helm_Chart SHALL include an `examples/` directory with at least two values files: standalone deployment and sidecar deployment
6. WHEN any example is followed as documented, THE example SHALL produce a working deployment or pipeline run without modification beyond providing credentials

