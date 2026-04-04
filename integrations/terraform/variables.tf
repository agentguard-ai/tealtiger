variable "tealtiger_version" {
  type        = string
  default     = "1.1.1"
  description = "TealTiger SDK version to deploy"

  validation {
    condition     = can(regex("^\\d+\\.\\d+\\.\\d+$", var.tealtiger_version))
    error_message = "Version must be valid semver (e.g., 1.1.1)"
  }
}

variable "guardrails" {
  type        = list(string)
  default     = ["pii", "prompt-injection", "content-moderation"]
  description = "Guardrails to enable in the deployed TealTiger instance"
}

variable "policy_file_path" {
  type        = string
  default     = ""
  description = "Path to TealTiger policy configuration file"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to apply to all resources"
}

# --- ECS Service submodule variables ---

variable "ecs_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Subnet IDs for the ECS service"
}

variable "ecs_security_group_ids" {
  type        = list(string)
  default     = []
  description = "Security group IDs for the ECS service"
}

variable "ecs_execution_role_arn" {
  type        = string
  default     = ""
  description = "IAM execution role ARN for the ECS service"
}

# --- Container Deployment submodule variables ---

variable "container_subnet_ids" {
  type        = list(string)
  default     = []
  description = "Subnet IDs for the container deployment"
}

variable "container_security_group_ids" {
  type        = list(string)
  default     = []
  description = "Security group IDs for the container deployment"
}

variable "container_execution_role_arn" {
  type        = string
  default     = ""
  description = "IAM execution role ARN for the container deployment"
}
