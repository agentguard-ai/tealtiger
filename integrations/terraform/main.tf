module "lambda_layer" {
  source = "./modules/lambda-layer"

  tealtiger_version = var.tealtiger_version
  guardrails        = var.guardrails
  tags              = var.tags
}

module "ecs_service" {
  source = "./modules/ecs-service"

  tealtiger_version  = var.tealtiger_version
  guardrails         = var.guardrails
  policy_file_path   = var.policy_file_path
  subnet_ids         = var.ecs_subnet_ids
  security_group_ids = var.ecs_security_group_ids
  execution_role_arn = var.ecs_execution_role_arn
  tags               = var.tags
}

module "container_deployment" {
  source = "./modules/container-deployment"

  tealtiger_version  = var.tealtiger_version
  guardrails         = var.guardrails
  policy_file_path   = var.policy_file_path
  cluster_arn        = module.ecs_service.ecs_cluster_arn
  subnet_ids         = var.container_subnet_ids
  security_group_ids = var.container_security_group_ids
  execution_role_arn = var.container_execution_role_arn
  tags               = var.tags
}
