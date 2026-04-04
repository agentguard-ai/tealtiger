# TealTiger Terraform Module

Terraform module for deploying TealTiger AI security infrastructure on AWS. Includes submodules for Lambda layers, ECS Fargate services, and generic container deployments.

## Prerequisites

- Terraform >= 1.5
- AWS Provider >= 5.0
- AWS credentials configured
- VPC with subnets (for ECS and container deployments)
- IAM execution roles for ECS tasks

## Usage

### Lambda Layer

Deploy TealTiger as an AWS Lambda layer:

```hcl
module "tealtiger_lambda" {
  source = "github.com/agentguard-ai/tealtiger//integrations/terraform/modules/lambda-layer"

  tealtiger_version = "1.1.1"
  runtime           = "nodejs20.x"

  tags = {
    Environment = "production"
  }
}
```

### ECS Service

Deploy TealTiger as an ECS Fargate service:

```hcl
module "tealtiger_ecs" {
  source = "github.com/agentguard-ai/tealtiger//integrations/terraform/modules/ecs-service"

  tealtiger_version  = "1.1.1"
  guardrails         = ["pii", "prompt-injection", "content-moderation"]
  subnet_ids         = ["subnet-abc123", "subnet-def456"]
  execution_role_arn = "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"

  tags = {
    Environment = "production"
  }
}
```

### Container Deployment

Deploy TealTiger as a generic container with custom environment variables:

```hcl
module "tealtiger_container" {
  source = "github.com/agentguard-ai/tealtiger//integrations/terraform/modules/container-deployment"

  tealtiger_version  = "1.1.1"
  guardrails         = ["pii", "prompt-injection"]
  cluster_arn        = "arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster"
  subnet_ids         = ["subnet-abc123"]
  execution_role_arn = "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"

  environment_variables = {
    CUSTOM_VAR = "value"
  }

  tags = {
    Environment = "staging"
  }
}
```

### Root Module (All Submodules)

Use the root module to deploy all components together:

```hcl
module "tealtiger" {
  source = "github.com/agentguard-ai/tealtiger//integrations/terraform"

  tealtiger_version           = "1.1.1"
  guardrails                  = ["pii", "prompt-injection", "content-moderation"]
  policy_file_path            = "./policies/tealtiger.yaml"
  ecs_subnet_ids              = ["subnet-abc123", "subnet-def456"]
  ecs_execution_role_arn      = "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"
  container_subnet_ids        = ["subnet-abc123"]
  container_execution_role_arn = "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"

  tags = {
    Project     = "tealtiger"
    Environment = "production"
  }
}
```

## Inputs

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `tealtiger_version` | TealTiger SDK version to deploy | `string` | `"1.1.1"` |
| `guardrails` | Guardrails to enable | `list(string)` | `["pii", "prompt-injection", "content-moderation"]` |
| `policy_file_path` | Path to policy configuration file | `string` | `""` |
| `tags` | Tags to apply to all resources | `map(string)` | `{}` |
| `ecs_subnet_ids` | Subnet IDs for the ECS service | `list(string)` | `[]` |
| `ecs_security_group_ids` | Security group IDs for the ECS service | `list(string)` | `[]` |
| `ecs_execution_role_arn` | IAM execution role ARN for ECS | `string` | `""` |
| `container_subnet_ids` | Subnet IDs for container deployment | `list(string)` | `[]` |
| `container_security_group_ids` | Security group IDs for container deployment | `list(string)` | `[]` |
| `container_execution_role_arn` | IAM execution role ARN for container | `string` | `""` |

## Outputs

| Name | Description |
|------|-------------|
| `lambda_layer_arn` | ARN of the TealTiger Lambda layer |
| `ecs_service_arn` | ARN of the TealTiger ECS service |
| `container_endpoint_url` | Endpoint URL for the container deployment |

## Examples

See the `examples/` directory for sample `.tfvars` files:

- `lambda-layer.tfvars` — Lambda layer deployment
- `ecs-service.tfvars` — ECS Fargate service deployment
- `container-deployment.tfvars` — Generic container deployment

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
