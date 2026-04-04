# TealTiger Helm Chart

Helm chart for deploying TealTiger AI security platform on Kubernetes. Supports standalone deployment and sidecar injection modes.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.0+

## Installation

### Standalone Mode

```bash
helm install tealtiger ./integrations/helm/tealtiger
```

### Sidecar Mode

```bash
helm install tealtiger ./integrations/helm/tealtiger --set mode=sidecar
```

### With Custom Values

```bash
helm install tealtiger ./integrations/helm/tealtiger -f my-values.yaml
```

## Configuration Reference

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mode` | Deployment mode (`standalone` or `sidecar`) | `standalone` |
| `image.repository` | Container image repository | `tealtigeradmin/tealtiger-docker` |
| `image.tag` | Container image tag | `1.1.1` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `guardrails.pii` | Enable PII detection | `true` |
| `guardrails.promptInjection` | Enable prompt injection detection | `true` |
| `guardrails.contentModeration` | Enable content moderation | `true` |
| `sensitivity` | Guardrail sensitivity (`low`, `medium`, `high`) | `medium` |
| `policyConfig` | Policy configuration (mounted as ConfigMap) | `{}` |
| `resources.requests.memory` | Memory request | `128Mi` |
| `resources.requests.cpu` | CPU request | `100m` |
| `resources.limits.memory` | Memory limit | `256Mi` |
| `resources.limits.cpu` | CPU limit | `500m` |
| `probes.liveness.path` | Liveness probe path | `/healthz` |
| `probes.liveness.port` | Liveness probe port | `8080` |
| `probes.liveness.initialDelaySeconds` | Liveness probe initial delay | `10` |
| `probes.readiness.path` | Readiness probe path | `/readyz` |
| `probes.readiness.port` | Readiness probe port | `8080` |
| `probes.readiness.initialDelaySeconds` | Readiness probe initial delay | `5` |
| `serviceAccount.create` | Create a service account | `true` |
| `serviceAccount.name` | Service account name (auto-generated if empty) | `""` |
| `ingress.enabled` | Enable ingress | `false` |
| `replicaCount` | Number of replicas | `1` |

## Deployment Modes

### Standalone

Creates a full Deployment, Service, ServiceAccount, and optional Ingress. TealTiger runs as an independent service.

```bash
helm install tealtiger ./integrations/helm/tealtiger \
  --set mode=standalone \
  --set guardrails.pii=true \
  --set sensitivity=high
```

### Sidecar

Creates a ConfigMap containing the sidecar container spec. Inject TealTiger as a sidecar into your existing workloads by referencing the ConfigMap.

```bash
helm install tealtiger ./integrations/helm/tealtiger \
  --set mode=sidecar
```

## Examples

See the `examples/` directory for sample values files:

- `standalone-values.yaml` — Standalone deployment with custom settings
- `sidecar-values.yaml` — Sidecar injection configuration

## Uninstall

```bash
helm uninstall tealtiger
```

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
