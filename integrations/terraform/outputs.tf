output "lambda_layer_arn" {
  description = "ARN of the TealTiger Lambda layer"
  value       = module.lambda_layer.lambda_layer_arn
}

output "ecs_service_arn" {
  description = "ARN of the TealTiger ECS service"
  value       = module.ecs_service.ecs_service_arn
}

output "container_endpoint_url" {
  description = "Endpoint URL for the TealTiger container deployment"
  value       = module.container_deployment.container_endpoint_url
}
