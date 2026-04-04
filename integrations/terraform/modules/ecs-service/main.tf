locals {
  cluster_arn = var.create_cluster ? aws_ecs_cluster.this[0].arn : var.existing_cluster_arn
  image       = "tealtigeradmin/tealtiger-docker:${var.tealtiger_version}"
}

resource "aws_ecs_cluster" "this" {
  count = var.create_cluster ? 1 : 0
  name  = var.cluster_name
  tags  = var.tags

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "tealtiger" {
  family                   = var.service_name
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
        {
          name  = "TEALTIGER_GUARDRAILS"
          value = join(",", var.guardrails)
        },
        {
          name  = "TEALTIGER_POLICY_FILE"
          value = var.policy_file_path
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
          "awslogs-group"         = "/ecs/${var.service_name}"
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "tealtiger"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "tealtiger" {
  name            = var.service_name
  cluster         = local.cluster_arn
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
