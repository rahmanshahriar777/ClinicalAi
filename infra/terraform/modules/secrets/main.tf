variable "environment" {}
variable "secret_names" { type = list(string) }

# Secrets are created empty; values are set out-of-band (never stored in Terraform state).
resource "aws_secretsmanager_secret" "s" {
  for_each                = toset(var.secret_names)
  name                    = "clinical/${var.environment}/${each.key}"
  recovery_window_in_days = 7
}
output "arns" { value = { for k, s in aws_secretsmanager_secret.s : k => s.arn } }
