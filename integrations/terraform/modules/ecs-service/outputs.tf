output "ecs_service_arn" {
  description = "ARN of the TealTiger ECS service"
  value       = aws_ecs_service.tealtiger.id
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = local.cluster_arn
}

output "task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.tealtiger.arn
}
