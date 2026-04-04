output "container_endpoint_url" {
  description = "Endpoint URL for the TealTiger container deployment"
  value       = "http://${var.deployment_name}.local:${var.container_port}"
}

output "task_definition_arn" {
  description = "ARN of the container task definition"
  value       = aws_ecs_task_definition.tealtiger.arn
}

output "service_arn" {
  description = "ARN of the container ECS service"
  value       = aws_ecs_service.tealtiger.id
}
