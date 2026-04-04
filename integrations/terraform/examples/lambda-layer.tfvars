# TealTiger Lambda Layer deployment example
# Usage: terraform apply -var-file=examples/lambda-layer.tfvars

tealtiger_version = "1.1.1"

guardrails = ["pii", "prompt-injection", "content-moderation"]

tags = {
  Project     = "tealtiger"
  Environment = "production"
  Component   = "lambda-layer"
}
