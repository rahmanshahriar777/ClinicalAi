output "api_url" { value = "https://${var.api_domain}" }
output "web_url" { value = "https://${var.web_domain}" }
output "database_endpoint" { value = module.database.endpoint, sensitive = true }
output "bucket_name" { value = module.storage.bucket_name }
