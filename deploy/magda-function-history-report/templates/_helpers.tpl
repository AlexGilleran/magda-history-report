{{/* vim: set filetype=mustache: */}}

{{/*
Generating the openfaas function namespace
*/}}
{{- define "magda-function-history-report.openfaaFunctionNamespace" -}}
{{- $namespacePrefix := .Values.global.openfaas.namespacePrefix | default .Release.Namespace -}}
{{- $functionNamespace := .Values.global.openfaas.functionNamespace | default "openfaas-fn" -}}
{{- if not $functionNamespace -}}
{{- fail "`functionNamespace` can't be empty"  -}}
{{- end -}}
{{- $functionNamespace | printf "%s-%s" (required "Please provide namespacePrefix for openfaas chart" $namespacePrefix) -}}
{{- end -}}

{{/*
Generating the magda registry url.
*/}}
{{- define "magda-function-history-report.registryApiUrl" -}}
{{- $namespacePrefix := .Values.global.openfaas.namespacePrefix | default .Release.Namespace -}}
{{- .Values.registryApiVersion | printf "http://registry-api.%s.svc.cluster.local/%s" $namespacePrefix -}}
{{- end -}}

{{/*
Generating the magda auth url.
*/}}
{{- define "magda-function-history-report.authApiUrl" -}}
{{- $namespacePrefix := .Values.global.openfaas.namespacePrefix | default .Release.Namespace -}}
{{- .Values.authApiVersion | printf "http://authorization-api.%s.svc.cluster.local/%s" $namespacePrefix -}}
{{- end -}}