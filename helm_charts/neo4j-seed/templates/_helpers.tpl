{{- define "neo4j-seed.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "neo4j-seed.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "neo4j-seed.labels" -}}
app.kubernetes.io/name: {{ include "neo4j-seed.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
