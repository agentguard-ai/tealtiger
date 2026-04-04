locals {
  image = "tealtigeradmin/tealtiger-docker:${var.tealtiger_version}"

  default_environment = {
    TEALTIGER_GUARDRAILS  = join(",", var.guardrails)
    TEALTIGER_POLICY_FILE = var.policy_file_path
  }

  environment = merge(local.default_environment, var.environment_variables)
}

resource "aws_ecs_task_definition" "tealtiger" {
  family                   = var.deployment_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn != "" ? var.task_role_arn : null
  tags                     = var.tags

  container_definitions = jsonencode([
    {
      name      = "tealtiger"
      image     = local.image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for k, v in local.environment : {
          name  = k
          value = v
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/healthz || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.deployment_name}"
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "tealtiger"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "tealtiger" {
  name            = var.deployment_name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.tealtiger.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  tags            = var.tags

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = var.assign_public_ip
  }
}

data "aws_region" "current" {}
