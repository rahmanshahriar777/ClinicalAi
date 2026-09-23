variable "region" { type = string, default = "eu-west-2" }
variable "environment" { type = string, validation { condition = contains(["dev", "staging", "prod"], var.environment), error_message = "dev|staging|prod" } }
variable "vpc_cidr" { type = string, default = "10.40.0.0/16" }
variable "db_instance_class" { type = string, default = "db.t4g.medium" }
variable "api_image" { type = string, description = "ECR image URI for apps/api" }
variable "web_image" { type = string, description = "ECR image URI for apps/web" }
variable "api_domain" { type = string }
variable "web_domain" { type = string }
variable "certificate_arn" { type = string }
variable "auth_mode" { type = string, default = "oidc" }
variable "auth_issuer" { type = string, description = "OIDC issuer URL (Cognito / Entra / Keycloak)" }
variable "ai_provider" { type = string, default = "bedrock" }
variable "bedrock_model_id" { type = string, default = "anthropic.claude-3-5-sonnet-20241022-v2:0" }
variable "bedrock_invoke_policy_arn" { type = string, description = "IAM policy allowing bedrock:InvokeModel on the chosen model" }
variable "external_ai_allowed" { type = bool, default = false, description = "Hard gate; only true with a signed BAA/DPA for the provider" }
variable "otel_endpoint" { type = string, default = "" }
