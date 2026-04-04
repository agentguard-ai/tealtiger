output "lambda_layer_arn" {
  description = "ARN of the TealTiger Lambda layer"
  value       = aws_lambda_layer_version.tealtiger.arn
}

output "lambda_layer_version" {
  description = "Version number of the TealTiger Lambda layer"
  value       = aws_lambda_layer_version.tealtiger.version
}
