# ---------------------------------------------------------------------------
# Clinical AI Platform — AWS reference deployment (blueprint §16.1, §20)
# Private VPC, RDS PostgreSQL (pgvector), ElastiCache Redis, S3 (KMS), ECS Fargate
# for api + web behind an ALB, Secrets Manager for all secrets.
# Bedrock/Azure OpenAI access is via VPC endpoints / private networking where available.
# ---------------------------------------------------------------------------
terraform {
  required_version = ">= 1.6"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.60" } }
  backend "s3" {} # configure via -backend-config (bucket, key, region, dynamodb_table)
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = "clinical-ai-platform", Environment = var.environment, DataClassification = "PHI" } }
}

module "network" {
  source      = "./modules/network"
  environment = var.environment
  cidr        = var.vpc_cidr
}

module "secrets" {
  source      = "./modules/secrets"
  environment = var.environment
  secret_names = ["JWT_SECRET", "FIELD_ENCRYPTION_KEY", "AZURE_OPENAI_API_KEY", "DATABASE_PASSWORD", "SENTRY_DSN"]
}

module "database" {
  source             = "./modules/database"
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  instance_class     = var.db_instance_class
  password_secret_arn = module.secrets.arns["DATABASE_PASSWORD"]
}

module "cache" {
  source             = "./modules/cache"
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
}

module "storage" {
  source      = "./modules/storage"
  environment = var.environment
}

module "api" {
  source             = "./modules/ecs-service"
  name               = "api"
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  image              = var.api_image
  container_port     = 4000
  health_check_path  = "/health/ready"
  cpu                = 1024
  memory             = 2048
  desired_count      = var.environment == "prod" ? 3 : 1
  environment_vars = {
    NODE_ENV                   = "production"
    AUTH_MODE                  = var.auth_mode
    AUTH_ISSUER                = var.auth_issuer
    AUTH_AUDIENCE              = "clinical-api"
    AI_PROVIDER                = var.ai_provider
    BEDROCK_MODEL_ID           = var.bedrock_model_id
    AWS_REGION                 = var.region
    EXTERNAL_AI_ALLOWED        = tostring(var.external_ai_allowed)
    ENABLE_PHI_REDACTION       = "true"
    REQUIRE_CLINICIAN_APPROVAL = "true"
    REDIS_URL                  = "rediss://${module.cache.endpoint}:6379"
    S3_BUCKET                  = module.storage.bucket_name
    S3_REGION                  = var.region
    S3_FORCE_PATH_STYLE        = "false"
    CORS_ORIGINS               = "https://${var.web_domain}"
    API_URL                    = "https://${var.api_domain}"
    WEB_URL                    = "https://${var.web_domain}"
    OTEL_ENABLED               = "true"
    OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_endpoint
  }
  secrets = {
    JWT_SECRET           = module.secrets.arns["JWT_SECRET"]
    FIELD_ENCRYPTION_KEY = module.secrets.arns["FIELD_ENCRYPTION_KEY"]
    DATABASE_URL         = module.database.connection_secret_arn
    SENTRY_DSN           = module.secrets.arns["SENTRY_DSN"]
    AZURE_OPENAI_API_KEY = module.secrets.arns["AZURE_OPENAI_API_KEY"]
  }
  extra_task_policies = [module.storage.rw_policy_arn, var.bedrock_invoke_policy_arn]
  certificate_arn     = var.certificate_arn
  domain              = var.api_domain
}

module "web" {
  source             = "./modules/ecs-service"
  name               = "web"
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  image              = var.web_image
  container_port     = 3000
  health_check_path  = "/login"
  cpu                = 512
  memory             = 1024
  desired_count      = var.environment == "prod" ? 2 : 1
  environment_vars   = { NODE_ENV = "production" }
  secrets            = {}
  extra_task_policies = []
  certificate_arn    = var.certificate_arn
  domain             = var.web_domain
}
