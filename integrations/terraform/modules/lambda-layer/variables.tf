variable "tealtiger_version" {
  type        = string
  description = "TealTiger SDK version for the Lambda layer"
}

variable "runtime" {
  type        = string
  default     = "nodejs20.x"
  description = "Lambda runtime for the layer (nodejs20.x or python3.12)"

  validation {
    condition     = contains(["nodejs20.x", "python3.12"], var.runtime)
    error_message = "Runtime must be nodejs20.x or python3.12"
  }
}

variable "guardrails" {
  type        = list(string)
  default     = ["pii", "prompt-injection", "content-moderation"]
  description = "Guardrails to enable"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to apply to resources"
}
