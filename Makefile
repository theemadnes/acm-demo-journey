create_yaml:
	@echo "Generating valid YAML for 03-Config-Connector referencing the project_id environment variable"
	envsubst < 03-config-connector/k8s-templates/service-account.yaml.template > 03-config-connector/k8s/app/service-account.yaml
	envsubst < 03-config-connector/k8s-templates/iam-wi-policy.yaml.template > 03-config-connector/k8s/gcp/iam-wi-policy.yaml
	envsubst < 03-config-connector/k8s-templates/iam-pubsub-policy.yaml.template > 03-config-connector/k8s/gcp/iam-pubsub-policy.yaml
	envsubst < 03-config-connector/k8s-templates/configmap.yaml.template > 03-config-connector/k8s/app/configmap.yaml