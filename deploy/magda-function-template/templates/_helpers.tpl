{{/* vim: set filetype=mustache: */}}

{{/*
Generating the openfaas function namespace
*/}}
{{- define "magda-function-template.openfaaFunctionNamespace" -}}
{{- $namespacePrefix := .Values.global.openfaas.namespacePrefix | default .Release.Namespace -}}
{{- $functionNamespace := .Values.global.openfaas.functionNamespace | default "openfaas-fn" -}}
{{- if not $functionNamespace -}}
{{- fail "`functionNamespace` can't be empty"  -}}
{{- end -}}
{{- $functionNamespace | printf "%s-%s" (required "Please provide namespacePrefix for openfaas chart" $namespacePrefix) -}}
{{- end -}}