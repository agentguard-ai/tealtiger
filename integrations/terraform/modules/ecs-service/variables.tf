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

variable "cluster_name" {
  type        = string
  default     = "tealtiger"
  description = "ECS cluster name. A new cluster is created if create_cluster is true."
}

variable "create_cluster" {
  type        = bool
  default     = true
  description = "Whether to create a new ECS cluster"
}

variable "existing_cluster_arn" {
  type        = string
  default     = ""
  description = "ARN of an existing ECS cluster (used when create_cluster is false)"
}

variable "service_name" {
  type        = string
  default     = "tealtiger"
  description = "Name of the ECS service"
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
  description = "Subnet IDs for the ECS service"
}

variable "security_group_ids" {
  type        = list(string)
  default     = []
  description = "Security group IDs for the ECS service"
}

variable "assign_public_ip" {
  type        = bool
  default     = false
  description = "Whether to assign a public IP to the task"
}

variable "execution_role_arn" {
  type        = string
  description = "IAM role ARN for ECS task execution"
}

variable "task_role_arn" {
  type        = string
  default     = ""
  description = "IAM role ARN for the ECS task (optional)"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to apply to resources"
}
