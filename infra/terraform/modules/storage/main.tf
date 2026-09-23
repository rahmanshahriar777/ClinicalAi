variable "environment" {}

data "aws_caller_identity" "me" {}

resource "aws_kms_key" "s3" {
  description         = "clinical-${var.environment} documents"
  enable_key_rotation = true
}

resource "aws_s3_bucket" "docs" { bucket = "clinical-${var.environment}-documents-${data.aws_caller_identity.me.account_id}" }

resource "aws_s3_bucket_versioning" "v" {
  bucket = aws_s3_bucket.docs.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "enc" {
  bucket = aws_s3_bucket.docs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
  }
}
resource "aws_s3_bucket_public_access_block" "pab" {
  bucket                  = aws_s3_bucket.docs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_lifecycle_configuration" "lc" {
  bucket = aws_s3_bucket.docs.id
  rule {
    id     = "noncurrent"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = 365 }
  }
}

resource "aws_iam_policy" "rw" {
  name = "clinical-${var.environment}-docs-rw"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = "${aws_s3_bucket.docs.arn}/*" },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.docs.arn },
      { Effect = "Allow", Action = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"], Resource = aws_kms_key.s3.arn }
    ]
  })
}

output "bucket_name" { value = aws_s3_bucket.docs.bucket }
output "rw_policy_arn" { value = aws_iam_policy.rw.arn }
