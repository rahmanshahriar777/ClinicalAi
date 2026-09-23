variable "environment" {}
variable "vpc_id" {}
variable "private_subnet_ids" { type = list(string) }

resource "aws_elasticache_subnet_group" "this" {
  name       = "clinical-${var.environment}"
  subnet_ids = var.private_subnet_ids
}
resource "aws_security_group" "redis" {
  name   = "clinical-${var.environment}-redis"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 6379
    to_port     = 6379
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
resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "clinical-${var.environment}"
  description                = "BullMQ queue + cache"
  engine                     = "redis"
  node_type                  = "cache.t4g.small"
  num_cache_clusters         = var.environment == "prod" ? 2 : 1
  automatic_failover_enabled = var.environment == "prod"
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.redis.id]
}
output "endpoint" { value = aws_elasticache_replication_group.this.primary_endpoint_address }
