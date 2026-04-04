{{/*
Expand the name of the chart.
*/}}
{{- define "tealtiger.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "tealtiger.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "tealtiger.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "tealtiger.labels" -}}
helm.sh/chart: {{ include "tealtiger.chart" . }}
{{ include "tealtiger.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "tealtiger.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tealtiger.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "tealtiger.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "tealtiger.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Build guardrails comma-separated string from values
*/}}
{{- define "tealtiger.guardrails" -}}
{{- $guardrails := list }}
{{- if .Values.guardrails.pii }}
{{- $guardrails = append $guardrails "pii" }}
{{- end }}
{{- if .Values.guardrails.promptInjection }}
{{- $guardrails = append $guardrails "prompt-injection" }}
{{- end }}
{{- if .Values.guardrails.contentModeration }}
{{- $guardrails = append $guardrails "content-moderation" }}
{{- end }}
{{- join "," $guardrails }}
{{- end }}

{{/*
Validate deployment mode
*/}}
{{- define "tealtiger.validateMode" -}}
{{- if and (ne .Values.mode "standalone") (ne .Values.mode "sidecar") }}
{{- fail "mode must be either 'standalone' or 'sidecar'" }}
{{- end }}
{{- end }}
