variable "name" {}
variable "environment" {}
variable "vpc_id" {}
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "image" {}
variable "container_port" { type = number }
variable "health_check_path" {}
variable "cpu" { type = number }
variable "memory" { type = number }
variable "desired_count" { type = number }
variable "environment_vars" { type = map(string) }
variable "secrets" { type = map(string) }
variable "extra_task_policies" { type = list(string) }
variable "certificate_arn" {}
variable "domain" {}

locals { full = "clinical-${var.environment}-${var.name}" }

data "aws_region" "r" {}

resource "aws_ecs_cluster" "this" {
  name = local.full
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
resource "aws_cloudwatch_log_group" "lg" {
  name              = "/clinical/${var.environment}/${var.name}"
  retention_in_days = 400
}

resource "aws_iam_role" "exec" {
  name               = "${local.full}-exec"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "exec" {
  role       = aws_iam_role.exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "exec_secrets" {
  role   = aws_iam_role.exec.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = length(var.secrets) > 0 ? values(var.secrets) : ["*"] }] })
}
resource "aws_iam_role" "task" {
  name               = "${local.full}-task"
  assume_role_policy = aws_iam_role.exec.assume_role_policy
}
resource "aws_iam_role_policy_attachment" "task_extra" {
  for_each   = toset(var.extra_task_policies)
  role       = aws_iam_role.task.name
  policy_arn = each.value
}

resource "aws_ecs_task_definition" "td" {
  family                   = local.full
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.exec.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name                   = var.name
    image                  = var.image
    essential              = true
    portMappings           = [{ containerPort = var.container_port, protocol = "tcp" }]
    environment            = [for k, v in var.environment_vars : { name = k, value = v }]
    secrets                = [for k, v in var.secrets : { name = k, valueFrom = v }]
    readonlyRootFilesystem = true
    linuxParameters        = { initProcessEnabled = true }
    logConfiguration = {
      logDriver = "awslogs"
      options   = { awslogs-group = aws_cloudwatch_log_group.lg.name, awslogs-region = data.aws_region.r.name, awslogs-stream-prefix = var.name }
    }
  }])
}

resource "aws_security_group" "alb" {
  name   = "${local.full}-alb"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
resource "aws_security_group" "svc" {
  name   = "${local.full}-svc"
  vpc_id = var.vpc_id
  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "alb" {
  name                       = substr(local.full, 0, 32)
  load_balancer_type         = "application"
  subnets                    = var.public_subnet_ids
  security_groups            = [aws_security_group.alb.id]
  drop_invalid_header_fields = true
}
resource "aws_lb_target_group" "tg" {
  name        = substr("${local.full}-tg", 0, 32)
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path     = var.health_check_path
    matcher  = "200"
    interval = 30
  }
}
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg.arn
  }
}

resource "aws_ecs_service" "svc" {
  name            = local.full
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.td.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.svc.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.tg.arn
    container_name   = var.name
    container_port   = var.container_port
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  depends_on = [aws_lb_listener.https]
}

output "alb_dns" { value = aws_lb.alb.dns_name }
