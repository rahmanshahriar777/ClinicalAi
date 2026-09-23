# Terraform (AWS reference)

```
cd infra/terraform
terraform init -backend-config=env/prod.backend.hcl
terraform workspace select prod || terraform workspace new prod
terraform apply -var-file=env/prod.tfvars
```

After the first apply: set secret values in Secrets Manager (`clinical/<env>/JWT_SECRET`, `FIELD_ENCRYPTION_KEY`,
`DATABASE_PASSWORD`, …), run `infra/scripts/db-migrate-deploy.sh` from a runner inside the VPC, then redeploy the API
service. An equivalent Azure layout (Container Apps + PostgreSQL Flexible Server + Azure OpenAI private endpoint) maps
module-for-module; see docs/architecture.md.
