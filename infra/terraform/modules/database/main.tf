variable "environment" {}
variable "vpc_id" {}
variable "private_subnet_ids" { type = list(string) }
variable "instance_class" {}
variable "password_secret_arn" {}

data "aws_secretsmanager_secret_version" "pw" { secret_id = var.password_secret_arn }

resource "aws_db_subnet_group" "this" {
  name       = "clinical-${var.environment}"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "db" {
  name   = "clinical-${var.environment}-db"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_kms_key" "db" {
  description         = "clinical-${var.environment} RDS"
  enable_key_rotation = true
}

resource "aws_db_instance" "this" {
  identifier                      = "clinical-${var.environment}"
  engine                          = "postgres"
  engine_version                  = "16"
  instance_class                  = var.instance_class
  allocated_storage               = 50
  max_allocated_storage           = 500
  db_name                         = "clinical"
  username                        = "clinical"
  password                        = data.aws_secretsmanager_secret_version.pw.secret_string
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.db.id]
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.db.arn
  multi_az                        = var.environment == "prod"
  backup_retention_period         = var.environment == "prod" ? 35 : 7
  deletion_protection             = var.environment == "prod"
  performance_insights_enabled    = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  skip_final_snapshot             = var.environment != "prod"
  # pgvector ships with RDS PostgreSQL 16; CREATE EXTENSION runs in the first migration.
}

resource "aws_secretsmanager_secret" "url" { name = "clinical/${var.environment}/DATABASE_URL" }
resource "aws_secretsmanager_secret_version" "url" {
  secret_id     = aws_secretsmanager_secret.url.id
  secret_string = "postgresql://clinical:${data.aws_secretsmanager_secret_version.pw.secret_string}@${aws_db_instance.this.address}:5432/clinical?sslmode=require"
}

output "endpoint" { value = aws_db_instance.this.address }
output "connection_secret_arn" { value = aws_secretsmanager_secret.url.arn }
