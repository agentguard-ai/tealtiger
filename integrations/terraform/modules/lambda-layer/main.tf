locals {
  layer_name = "tealtiger-${replace(var.tealtiger_version, ".", "-")}-${var.runtime}"
}

resource "aws_lambda_layer_version" "tealtiger" {
  layer_name          = local.layer_name
  description         = "TealTiger SDK v${var.tealtiger_version} for ${var.runtime}"
  compatible_runtimes = [var.runtime]

  # The layer content is fetched from the TealTiger release artifacts.
  # In production, replace this with the actual S3 bucket or local path
  # to the packaged TealTiger SDK layer zip.
  filename = "${path.module}/layer.zip"

  lifecycle {
    create_before_destroy = true
  }
}
