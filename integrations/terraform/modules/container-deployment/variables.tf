variable "tealtiger_version" {
  type        = string
  description = "TealTiger Docker image tag version"
}

variable "guardrails" {
  type        = list(string)
  default     = ["pii", "prompt-injection", "content-moderation"]
  description = "Guardrails to enable"
}

variable "policy_file_path" {
  type        = string
  default     = ""
  description = "Path to TealTiger policy configuration file"
}

variable "deployment_name" {
  type        = string
  default     = "tealtiger-container"
  description = "Name for the container deployment"
}

variable "cluster_arn" {
  type        = string
  description = "ARN of the ECS cluster to deploy into"
}

variable "desired_count" {
  type        = number
  default     = 1
  description = "Desired number of tasks"
}

variable "cpu" {
  type        = number
  default     = 256
  description = "CPU units for the task (256 = 0.25 vCPU)"
}

variable "memory" {
  type        = number
  default     = 512
  description = "Memory in MiB for the task"
}

variable "container_port" {
  type        = number
  default     = 8080
  description = "Container port to expose"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for the deployment"
}

variable "security_group_ids" {
  type        = list(string)
  default     = []
  description = "Security group IDs for the deployment"
}

variable "assign_public_ip" {
  type        = bool
  default     = false
  description = "Whether to assign a public IP"
}

variable "execution_role_arn" {
  type        = string
  description = "IAM role ARN for task execution"
}

variable "task_role_arn" {
  type        = string
  default     = ""
  description = "IAM role ARN for the task (optional)"
}

variable "environment_variables" {
  type        = map(string)
  default     = {}
  description = "Additional environment variables for the container"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to apply to resources"
}
