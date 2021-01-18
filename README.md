# acm-demo-journey
Basic walkthrough of Anthos Config Management capabilities ([Config Sync](https://cloud.google.com/kubernetes-engine/docs/add-on/config-sync/overview) &amp; [Policy Controller](https://cloud.google.com/anthos-config-management/docs/concepts/policy-controller)) as well as integration with [Config Connector](https://cloud.google.com/config-connector/docs/overview)'s [KRM](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/architecture/resource-management.md) model for GCP resources.

This walkthrough assumes you have Anthos Config Management already installed (the operator, specifically) on your GKE cluster(s). If you haven't already done this, follow [these](https://cloud.google.com/anthos-config-management/docs/how-to/installing) instructions. If, on the other hand, you have no idea what Anthos Config Management is and you landed here by mistake, take a moment to familiarize yourself with ACM  via an overview [here](https://cloud.google.com/anthos-config-management/docs/overview).

This isn't meant to be a deep dive in to all the various bells and whistles that ACM provides - we're not going to touch things like [Binary Authorization](https://cloud.google.com/binary-authorization/docs/overview) nor the [Heirarchy Controller](https://cloud.google.com/kubernetes-engine/docs/add-on/config-sync/concepts/hierarchy-controller) - but this should be enough to start building some muscle memory on how to simplify multi-cluster management *and* defining guardrails for configuration within those clusters. 

## Prerequisites

As mentioned in the prior section, we're going to assume you have the `config-management-operator` deployed to your GKE cluster as decscribed [here](https://cloud.google.com/anthos-config-management/docs/how-to/installing-config-sync#configuring-config-sync).

For the configuration of ACM beyond that, the following section includes a sample `configManagement` spec YAML that will get you up and running with minimal modification. 

You'll also need `envsubst` installed in your path for some YAML generation that will happen in part 3.

## 01-config-sync

Let's actually deploy the config sync and policy controller bits first. There is a sample `config-management.yaml` in `01-config-sync/sample-config-management`. Tweak the cluster name if you wish, and apply it:

```
$ kubectl apply -f 01-config-sync/sample-config-management/config-management.yaml
configmanagement.configmanagement.gke.io/config-management created
```

A few things will happen after you apply that YAML. The pods for Config Sync and Policy Controller will get deployed, and with Config Sync deployed, your cluster will now start watching the `policyDir` defined in `01-config-sync/sample-config-management/config-management.yaml`. If Config Sync is working properly, you'll have 3 additional namespaces (`foo`, `inherited-demo-01`, and `inherited-demo-01`):

```
$ kubectl get ns
configmanagement.configmanagement.gke.io/config-management created
NAME                       STATUS   AGE
foo                        Active   7m46s
********  OTHER NAMESPACE STUFF  ********
inherited-demo-01          Active   7m46s
inherited-demo-02          Active   7m46s
```

Verify that Config Sync is constantly reconciling the configuration of your cluster against the desired state in the `policyDir` by deleting the `foo` namespace, and verifying that it gets re-created automatically in near-realtime:

```
$ kubectl delete ns foo
namespace "foo" deleted

$ kubectl get ns foo
NAME    STATUS   AGE
foo     Active   28s
```

Last thing we're going to verify is that namespace inheritence is working. Namespace inheritence is described [here](https://cloud.google.com/kubernetes-engine/docs/add-on/config-sync/concepts/namespace-inheritance). For our example, `01-config-sync/namespaces/inherited-example` is an "abstract namespace directory" that contains `inherited-configmap.yaml`, a sample `configMap`. Namespace inheritence allows us to define that namespace spec once, and the two namespaces defined (`inherited-demo-01` and `inherited-demo-02`) will both "inherit" the configMap.

```
$ kubectl get cm/inherited-configmap -oyaml -n inherited-demo-01
apiVersion: v1
data:
  database: bar-db
  database_uri: bar-db://1.1.1.1:1234
kind: ConfigMap

$ kubectl get cm/inherited-configmap -oyaml -n inherited-demo-02
apiVersion: v1
data:
  database: bar-db
  database_uri: bar-db://1.1.1.1:1234
kind: ConfigMap
```

## 02-policy-controller-basic

Let's start with a simple example of leveraging Policy Controller to establish some guardrails for Kubernetes resources. In this section, you'll leverage the existing [constraint template library](https://cloud.google.com/anthos-config-management/docs/reference/constraint-template-library) to get a simple policy deployed.


If you want to get a print-out of what constraint templates you have at your disposal, run the following command:

```
$ kubectl get constrainttemplates
NAME                                      AGE
allowedserviceportname                    17h
destinationruletlsenabled                 17h
disallowedauthzprefix                     17h
*** trucated for brevity                  ***
k8spspselinuxv2                           17h
k8spspvolumetypes                         17h
k8srequiredlabels                         17h
k8srestrictnamespaces                     17h
k8srestrictrolebindings                   17h
policystrictonly                          17h
sourcenotallauthz                         17h
```

Let's use the [`k8srequiredlabels`](https://cloud.google.com/anthos-config-management/docs/reference/constraint-template-library#k8srequiredlabels) constraint to enforce a labeling / tagging taxonomy. The following command will print out the details of the constraint template, including the policy language (written in Rego):

```
$ kubectl describe constrainttemplates k8srequiredlabels
```

Now we can create a constraint the leverages the `k8srequiredlabels` template. Take a look at the constraint spec:

```
$ cat 02-policy-controller-basic/pod-buzz-label-constraint.yaml 
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: pod-must-have-buzz-label
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - foo
  parameters:
    labels:
      - key: "buzz"
  #enforcementAction: dryrun # dryrun == audit mode
```

Notice the `kind` field references the constraint template. Also, within the spec, the constraint is scoped specifically to pods in the `foo` namespace, and is requiring that the pod has a label with a key of "buzz" applied to it. Lastly, notice that the `enforcementAction` field is commented out; this means that the policy will be enforced by the admission controller and creation of a pod *without* the "buzz" label in the `foo` namespace will be blocked. Uncommenting this field will switch to audit mode instead.

Apply the constraint:

```
$ kubectl apply -f 02-policy-controller-basic/pod-buzz-label-constraint.yaml 
k8srequiredlabels.constraints.gatekeeper.sh/pod-must-have-buzz-label created
```

Now try to deploy a pod that has the `buzz` label commented out in its spec (see line 8):

```
$ kubectl apply -f 02-policy-controller-basic/fizz-pod.yaml 
Error from server ([denied by pod-must-have-buzz-label] you must provide labels: {"buzz"}): error when creating "02-policy-controller-basic/fizz-pod.yaml": admission webhook "validation.gatekeeper.sh" denied the request: [denied by pod-must-have-buzz-label] you must provide labels: {"buzz"}
```

You have a few options for remediation. You can modify the pod spec YAML and uncomment the "buzz" label (line 8 of `02-policy-controller-basic/fizz-pod.yaml`) *or* you can switch the constraint's `enforcementAction` to audit mode (by uncommenting line 15 of `02-policy-controller-basic/pod-buzz-label-constraint.yaml`), so a non-compliant pod can be created, but will be logged for non-compliance. If you choose to do the latter, run the following, and you should see the offending pod has been logged: 

```
$ kubectl describe K8sRequiredLabels/pod-must-have-buzz-label
```

## 03-config-connector

In this section, you're going to use the Kubernetes Resource Model to deploy both the application elements common to Kubernetes (pods, service, etc) *and* some GCP resources outside of the GKE cluster that the application will interact with. This walkthrough has been tested using the Config Connector [GKE Add-on installation](https://cloud.google.com/config-connector/docs/how-to/install-upgrade-uninstall) method, although there are [alternative approaches](https://cloud.google.com/config-connector/docs/how-to/advanced-install).

Make sure you've completed the Config Connector setup (service account setup, policy binding, and applying the ConfigConector YAML), and that you've enabled the Resource Manager API:

```
$ gcloud services enable cloudresourcemanager.googleapis.com
```

For this walkthrough, the K8s resources for both the app elements and the GCP infrastructure will live in the same K8s namespace called `config-connector-demo-app`. The YAML used to create that namespace, along with several other YAML manifests require references to your project ID. To simplify things, we've included some YAML "templates" in `03-config-connector/k8s-templates` that we'll use the `envsubst` command (by way of `make`) to generate valid K8s YAML from:

```
$ export project_id=$(gcloud config get-value project) # or whatever project you want to use
$ make
Generating valid YAML for 03-Config-Connector referencing the project_id environment variable
envsubst < 03-config-connector/k8s-templates/service-account.yaml.template > 03-config-connector/k8s/app/service-account.yaml
envsubst < 03-config-connector/k8s-templates/iam-wi-policy.yaml.template > 03-config-connector/k8s/gcp/iam-wi-policy.yaml
envsubst < 03-config-connector/k8s-templates/iam-pubsub-policy.yaml.template > 03-config-connector/k8s/gcp/iam-pubsub-policy.yaml
envsubst < 03-config-connector/k8s-templates/configmap.yaml.template > 03-config-connector/k8s/app/configmap.yaml
envsubst < 03-config-connector/k8s-templates/namespace.yaml.template > 03-config-connector/k8s/app/namespace.yaml
```

To get a print-out of supported GCP resources on whatever version of Config Connector you're using, run:

```
$ kubectl get crds --selector cnrm.cloud.google.com/managed-by-kcc=true
```


