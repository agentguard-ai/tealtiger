# TealTiger Container Deployment example
# Usage: terraform apply -var-file=examples/container-deployment.tfvars

tealtiger_version = "1.1.1"

guardrails = ["pii", "prompt-injection"]

policy_file_path = ""

container_subnet_ids = ["subnet-abc123"]

container_execution_role_arn = "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"

tags = {
  Project     = "tealtiger"
  Environment = "staging"
  Component   = "container-deployment"
}
