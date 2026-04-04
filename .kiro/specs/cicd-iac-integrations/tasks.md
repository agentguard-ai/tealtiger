# Implementation Plan: CI/CD and IaC Integration Artifacts

## Overview

Create the six integration artifacts that the existing launch pipeline (CICDPublisher, IaCPublisher) is wired to publish: a shared scan entrypoint script, GitHub Action, GitLab CI template, CircleCI Orb, Terraform module, and Helm chart. All CI/CD integrations delegate to the shared entrypoint script. All artifacts live under `integrations/`.

## Tasks

- [x] 1. Create shared scan entrypoint script and directory structure
  - [x] 1.1 Create `integrations/cicd/shared/tealtiger-scan.sh` entrypoint script
    - Create the POSIX-compatible bash script that reads `TEALTIGER_SCAN_PATH`, `TEALTIGER_GUARDRAILS`, `TEALTIGER_SENSITIVITY`, `TEALTIGER_POLICY_FILE`, `TEALTIGER_FAIL_ON_FINDING`, `TEALTIGER_REPORT_FORMAT`, and `TEALTIGER_REPORT_OUTPUT` environment variables
    - Apply defaults: guardrails=`pii,prompt-injection,content-moderation`, sensitivity=`medium`, fail-on-finding=`true`, report-format=`json`, report-output=`./tealtiger-report`
    - Validate `TEALTIGER_SCAN_PATH` is set and exists; exit code 2 with descriptive error if not
    - Validate `TEALTIGER_SENSITIVITY` is one of low/medium/high; exit code 2 if invalid
    - Validate `TEALTIGER_REPORT_FORMAT` is one of json/junit/sarif; exit code 2 if invalid
    - Validate each guardrail in `TEALTIGER_GUARDRAILS` is one of pii/prompt-injection/content-moderation; exit code 2 if invalid
    - Check TealTiger CLI is available (`npx tealtiger --version`); exit code 2 if not found
    - Run guardrail scan: `npx tealtiger scan --path "$TEALTIGER_SCAN_PATH" --guardrails "$TEALTIGER_GUARDRAILS" --sensitivity "$TEALTIGER_SENSITIVITY" --format "$TEALTIGER_REPORT_FORMAT" --output "$TEALTIGER_REPORT_OUTPUT/scan-report"`
    - If `TEALTIGER_POLICY_FILE` is set, run policy test: `npx tealtiger test "$TEALTIGER_POLICY_FILE" --format "$TEALTIGER_REPORT_FORMAT" --output "$TEALTIGER_REPORT_OUTPUT/policy-report"`
    - Merge exit codes: any failure = failure. Exit 1 if violations found and fail-on-finding is true, exit 0 otherwise
    - Make script executable (`chmod +x`)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [ ]* 1.2 Write property test for entrypoint default configuration
    - **Property 4: Entrypoint Default Configuration**
    - Use fast-check to generate random subsets of the 4 optional env vars to leave unset
    - For each unset variable, verify the script applies the correct default value
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6**

  - [ ]* 1.3 Write property test for entrypoint exit code correctness
    - **Property 5: Entrypoint Exit Code Correctness**
    - Use fast-check to generate random combinations of: scan path validity (exists/missing/empty), finding count (0 to N), fail-on-finding (true/false)
    - Verify exit code 2 for invalid path, exit code 1 for violations + fail-on-finding=true, exit code 0 otherwise
    - **Validates: Requirements 6.7, 6.8, 6.10**

  - [ ]* 1.4 Write property test for report file output
    - **Property 6: Report File Output**
    - Use fast-check to generate random output paths and report formats
    - Verify a parseable report file exists at the specified path after scan execution
    - **Validates: Requirements 6.9**

- [x] 2. Checkpoint - Ensure shared entrypoint tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create GitHub Action for GitHub Marketplace
  - [x] 3.1 Create `integrations/cicd/github-action/action.yml` metadata file
    - Set `name: "TealTiger Security Scan"`, branding icon and color
    - Define `runs.using: docker` with `runs.image: Dockerfile`
    - Define inputs: `scan-path` (required), `guardrails` (default: `pii,prompt-injection,content-moderation`), `sensitivity` (default: `medium`), `policy-file` (default: empty), `fail-on-finding` (default: `true`), `report-format` (default: `json`)
    - Define outputs: `report` (path to report file), `findings-count` (number of violations), `passed` (true/false)
    - Map each input to the corresponding `TEALTIGER_*` environment variable
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.13_

  - [x] 3.2 Create `integrations/cicd/github-action/Dockerfile`
    - Thin wrapper: `FROM tealtigeradmin/tealtiger-docker:latest`
    - Copy `../shared/tealtiger-scan.sh` into `/usr/local/bin/tealtiger-scan.sh`
    - Set executable permissions and set as `ENTRYPOINT`
    - _Requirements: 1.1_

  - [x] 3.3 Create `integrations/cicd/github-action/README.md` with usage examples and quickstart workflow snippet
    - Include input/output documentation table
    - Include quickstart workflow snippet showing `uses: agentguard-ai/tealtiger-action@v1`
    - _Requirements: 1.14_

  - [x] 3.4 Create `integrations/cicd/github-action/LICENSE` (Apache 2.0)
    - _Requirements: 1.15_

  - [x] 3.5 Create `integrations/cicd/github-action/examples/` directory with example workflows
    - Create `basic-scan.yml`: minimal workflow using the action with just `scan-path`
    - Create `advanced-policy-sarif.yml`: workflow with policy testing, SARIF report format, and GitHub Code Scanning upload step
    - _Requirements: 7.1, 1.12_

  - [ ]* 3.6 Write unit tests for GitHub Action artifact structure
    - Verify `action.yml` is valid YAML with `runs.using: docker`
    - Verify all 6 inputs defined with correct types and defaults
    - Verify all 3 outputs defined
    - Verify branding icon and color are set
    - Verify README.md contains usage examples
    - Verify LICENSE is Apache 2.0
    - Verify examples directory contains both workflow files
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.13, 1.14, 1.15, 7.1_

- [x] 4. Create GitLab CI reusable template
  - [x] 4.1 Create `integrations/cicd/gitlab-ci/.gitlab-ci.yml` reusable template
    - Define `tealtiger-scan` job in `test` stage using TealTiger Docker image
    - Define `tealtiger-policy-test` job in `test` stage using TealTiger Docker image
    - Both jobs invoke `tealtiger-scan.sh` (downloaded or embedded in `before_script`)
    - Accept CI/CD variables: `TEALTIGER_SCAN_PATH`, `TEALTIGER_GUARDRAILS`, `TEALTIGER_SENSITIVITY`, `TEALTIGER_POLICY_FILE`, `TEALTIGER_FAIL_ON_FINDING`
    - Configure `artifacts.reports.junit` for JUnit XML output
    - Configure `artifacts.reports.codequality` for GitLab Code Quality JSON output
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 4.2 Create `integrations/cicd/gitlab-ci/README.md` with usage examples and variable documentation
    - _Requirements: 2.9_

  - [x] 4.3 Create `integrations/cicd/gitlab-ci/LICENSE` (Apache 2.0)
    - _Requirements: 2.10_

  - [x] 4.4 Create `integrations/cicd/gitlab-ci/examples/` directory with example pipelines
    - Create `basic-scan.yml`: minimal pipeline including the template
    - Create `advanced-policy-codequality.yml`: pipeline with policy testing and Code Quality reporting
    - _Requirements: 7.2_

  - [ ]* 4.5 Write unit tests for GitLab CI template structure
    - Verify `.gitlab-ci.yml` is valid YAML
    - Verify `tealtiger-scan` and `tealtiger-policy-test` jobs are defined
    - Verify both jobs use the TealTiger Docker image
    - Verify both jobs are in the `test` stage
    - Verify JUnit and Code Quality artifact reports are configured
    - Verify all `TEALTIGER_*` variables are referenced
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 5. Create CircleCI Orb
  - [x] 5.1 Create `integrations/cicd/circleci-orb/orb.yml` orb definition
    - Define `tealtiger` executor using `tealtigeradmin/tealtiger-docker` Docker image
    - Define `scan` command with parameters: `scan-path`, `guardrails`, `sensitivity`, `fail-on-finding`, `report-format` — matching GitHub Action input semantics and defaults
    - Define `policy-test` command with parameter: `policy-file`
    - Define `full-scan` job combining `scan` and `policy-test` commands using the `tealtiger` executor
    - Include `store_test_results` step for CircleCI test insights integration
    - Include `store_artifacts` step for the scan report
    - Include inline usage examples in the orb metadata
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 5.2 Create `integrations/cicd/circleci-orb/README.md` with usage documentation
    - _Requirements: 3.9_

  - [x] 5.3 Create `integrations/cicd/circleci-orb/LICENSE` (Apache 2.0)
    - _Requirements: 3.10_

  - [ ]* 5.4 Write unit tests for CircleCI Orb structure
    - Verify `orb.yml` is valid CircleCI orb YAML
    - Verify `scan` and `policy-test` commands are defined
    - Verify `full-scan` job is defined
    - Verify `tealtiger` executor is defined with correct Docker image
    - Verify `store_test_results` step is present
    - Verify inline examples are present
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.9_

- [x] 6. Checkpoint - Ensure all CI/CD integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Write cross-artifact parameter consistency property test
  - [ ]* 7.1 Write property test for cross-artifact parameter consistency
    - **Property 2: Cross-Artifact Parameter Consistency**
    - Parse `action.yml`, `orb.yml`, and `.gitlab-ci.yml`
    - For each parameter in `action.yml`, verify a matching parameter exists in `orb.yml` with the same default value
    - For each parameter in `action.yml`, verify the corresponding `TEALTIGER_*` variable is referenced in `.gitlab-ci.yml`
    - **Validates: Requirements 3.5, 6.2**

- [x] 8. Create Terraform module
  - [x] 8.1 Create `integrations/terraform/versions.tf` with provider requirements
    - Require Terraform >= 1.5
    - Require AWS provider >= 5.0
    - _Requirements: 4.9_

  - [x] 8.2 Create `integrations/terraform/variables.tf` with root module variables
    - Define `tealtiger_version` (string, default `"1.1.1"`) with semver validation
    - Define `guardrails` (list of strings, default `["pii", "prompt-injection", "content-moderation"]`)
    - Define `policy_file_path` (string, default `""`)
    - Define `tags` (map of strings)
    - _Requirements: 4.2, 4.6, 4.7_

  - [x] 8.3 Create `integrations/terraform/modules/lambda-layer/` submodule
    - Create `main.tf` with `aws_lambda_layer_version` resource for TealTiger SDK
    - Accept `runtime` variable (nodejs20.x or python3.12)
    - Create `variables.tf` with submodule-specific variables
    - Create `outputs.tf` outputting `lambda_layer_arn`
    - _Requirements: 4.3, 4.8_

  - [x] 8.4 Create `integrations/terraform/modules/ecs-service/` submodule
    - Create `main.tf` with `aws_ecs_service`, `aws_ecs_task_definition`, optional `aws_ecs_cluster` resources running TealTiger Docker image
    - Create `variables.tf` with submodule-specific variables (VPC, subnets, etc.)
    - Create `outputs.tf` outputting `ecs_service_arn`
    - _Requirements: 4.4, 4.8_

  - [x] 8.5 Create `integrations/terraform/modules/container-deployment/` submodule
    - Create `main.tf` with generic container deployment using TealTiger Docker image with configurable environment variables
    - Create `variables.tf` with submodule-specific variables
    - Create `outputs.tf` outputting `container_endpoint_url`
    - _Requirements: 4.5, 4.8_

  - [x] 8.6 Create `integrations/terraform/main.tf` root module and `outputs.tf`
    - Wire root module to submodules, passing common variables
    - Create `outputs.tf` exposing `lambda_layer_arn`, `ecs_service_arn`, `container_endpoint_url`
    - _Requirements: 4.1, 4.8_

  - [x] 8.7 Create `integrations/terraform/README.md` with usage examples for each submodule
    - Include input/output documentation and prerequisite instructions
    - _Requirements: 4.10_

  - [x] 8.8 Create `integrations/terraform/LICENSE` (Apache 2.0)
    - _Requirements: 4.11_

  - [x] 8.9 Create `integrations/terraform/examples/` with example `.tfvars` files
    - Create `lambda-layer.tfvars`, `ecs-service.tfvars`, `container-deployment.tfvars`
    - _Requirements: 4.12, 7.4_

  - [ ]* 8.10 Write unit tests for Terraform module structure
    - Verify `versions.tf` requires Terraform >= 1.5 and AWS provider >= 5.0
    - Verify all three submodule directories exist with main.tf, variables.tf, outputs.tf
    - Verify root module variables include `tealtiger_version`, `guardrails`, `policy_file_path`
    - Verify root module outputs include `lambda_layer_arn`, `ecs_service_arn`, `container_endpoint_url`
    - Verify example `.tfvars` files exist for all three scenarios
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 4.8, 4.9, 4.12_

- [x] 9. Checkpoint - Ensure Terraform module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Create Helm chart for Kubernetes
  - [x] 10.1 Create `integrations/helm/tealtiger/Chart.yaml`
    - Set `apiVersion: v2`, `name: tealtiger`, `version: 1.1.1`, `appVersion: 1.1.1`, `type: application`
    - _Requirements: 5.1_

  - [x] 10.2 Create `integrations/helm/tealtiger/values.yaml` with defaults
    - Set `mode: standalone`, image `tealtigeradmin/tealtiger-docker:1.1.1`, `pullPolicy: IfNotPresent`
    - Set guardrails (pii: true, promptInjection: true, contentModeration: true), sensitivity: medium
    - Set resource requests (128Mi memory, 100m CPU) and limits (256Mi memory, 500m CPU)
    - Set liveness probe (`/healthz:8080`, initialDelay 10s) and readiness probe (`/readyz:8080`, initialDelay 5s)
    - Set serviceAccount.create: true, ingress.enabled: false
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9_

  - [x] 10.3 Create `integrations/helm/tealtiger/values.schema.json`
    - JSON Schema validating: `mode` must be `standalone` or `sidecar`, `image.repository` and `image.tag` non-empty strings, `guardrails.*` booleans, `sensitivity` one of low/medium/high, resource quantities, probe configuration
    - _Requirements: 5.10_

  - [x] 10.4 Create `integrations/helm/tealtiger/templates/_helpers.tpl`
    - Define template helpers for chart name, fullname, labels, selector labels, service account name
    - Include validation helpers for mode selection
    - _Requirements: 5.1_

  - [x] 10.5 Create `integrations/helm/tealtiger/templates/deployment.yaml`
    - Template a Deployment for `standalone` mode with TealTiger container, resource limits, probes, guardrail env vars
    - For `sidecar` mode, template a ConfigMap with sidecar container spec
    - _Requirements: 5.2, 5.3, 5.8, 5.9_

  - [x] 10.6 Create remaining Helm template files
    - Create `templates/service.yaml` — Service for standalone mode
    - Create `templates/configmap.yaml` — ConfigMap for policy configuration mounting
    - Create `templates/serviceaccount.yaml` — ServiceAccount resource
    - Create `templates/ingress.yaml` — optional Ingress resource (controlled by `ingress.enabled`)
    - Create `templates/NOTES.txt` — post-installation instructions
    - _Requirements: 5.6, 5.7, 5.12_

  - [x] 10.7 Create `integrations/helm/tealtiger/README.md` with installation instructions and configuration reference
    - Include examples for standalone and sidecar modes
    - _Requirements: 5.11_

  - [x] 10.8 Create `integrations/helm/tealtiger/LICENSE` (Apache 2.0)
    - _Requirements: 5.13_

  - [x] 10.9 Create `integrations/helm/tealtiger/examples/` with example values files
    - Create `standalone-values.yaml` and `sidecar-values.yaml`
    - _Requirements: 7.5_

  - [ ]* 10.10 Write property test for Helm values schema validates defaults
    - **Property 3: Helm Values Schema Validates Defaults**
    - Use fast-check to generate random valid values.yaml configurations conforming to the schema
    - Validate each against `values.schema.json` using `ajv`
    - Verify the shipped default `values.yaml` passes validation
    - **Validates: Requirements 5.10**

  - [ ]* 10.11 Write unit tests for Helm chart structure
    - Verify `Chart.yaml` has apiVersion v2, correct name and version
    - Verify `values.yaml` has correct defaults (128Mi request, 256Mi limit, mode=standalone)
    - Verify `values.schema.json` is valid JSON Schema
    - Verify all template files exist
    - Verify standalone mode templates produce Deployment + Service
    - Verify sidecar mode templates produce ConfigMap with sidecar spec
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.8, 5.10, 5.14_

- [x] 11. Checkpoint - Ensure all Helm chart tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Wire integrations together and write SARIF property test
  - [x] 12.1 Verify all CI/CD integrations reference `tealtiger-scan.sh`
    - Confirm GitHub Action Dockerfile copies the shared entrypoint
    - Confirm GitLab CI template downloads or embeds the shared entrypoint
    - Confirm CircleCI Orb commands invoke the shared entrypoint
    - _Requirements: 6.1_

  - [ ]* 12.2 Write property test for SARIF report schema validity
    - **Property 1: SARIF Report Schema Validity**
    - Use fast-check to generate random sets of findings (0 to N, random guardrail types, random file paths)
    - Call the SARIF formatter and validate output against SARIF v2.1.0 JSON Schema using `ajv`
    - Verify `tool.driver.name` equals `"TealTiger"`, `tool.driver.rules[]` has one entry per guardrail type, `results[]` has one entry per finding with valid `physicalLocation`
    - **Validates: Requirements 1.12**

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major component
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific structural and content requirements for each artifact
- All CI/CD integrations delegate to the shared `tealtiger-scan.sh` entrypoint for consistency
- All artifacts use Apache 2.0 license
- The implementation language is bash for the entrypoint, YAML for CI/CD configs, HCL for Terraform, and TypeScript for tests
