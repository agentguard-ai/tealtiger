# TealTiger ECS Service deployment example
# Usage: terraform apply -var-file=examples/ecs-service.tfvars

tealtiger_version = "1.1.1"

guardrails = ["pii", "prompt-injection", "content-moderation"]

policy_file_path = "./policies/tealtiger.yaml"

ecs_subnet_ids = ["subnet-abc123", "subnet-def456"]

ecs_execution_role_arn = "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"

tags = {
  Project     = "tealtiger"
  Environment = "production"
  Component   = "ecs-service"
}
