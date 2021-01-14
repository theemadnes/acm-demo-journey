# acm-demo-journey
Basic walkthrough of Anthos Config Management capabilities ([Config Sync](https://cloud.google.com/kubernetes-engine/docs/add-on/config-sync/overview) &amp; [Policy Controller](https://cloud.google.com/anthos-config-management/docs/concepts/policy-controller)) as well as integration with [Config Connector](https://cloud.google.com/config-connector/docs/overview)'s [KRM](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/architecture/resource-management.md) model for GCP resources.

This walkthrough assumes you have Anthos Config Management already installed (the operator, specifically) on your GKE cluster(s). If you haven't already done this, follow [these](https://cloud.google.com/anthos-config-management/docs/how-to/installing) instructions. If, on the other hand, you have no idea what Anthos Config Management is and you landed here by mistake, take a moment to familiarize yourself with ACM  via an overview [here](https://cloud.google.com/anthos-config-management/docs/overview).

This isn't meant to be a deep dive in to all the various bells and whistles that ACM provides - we're not going to touch things like [Binary Authorization](https://cloud.google.com/binary-authorization/docs/overview) nor the [Heirarchy Controller](https://cloud.google.com/kubernetes-engine/docs/add-on/config-sync/concepts/hierarchy-controller) - but this should be enough to start building some muscle memory on how to simplify multi-cluster management *and* defining guardrails for configuration within those clusters. 

#### Setup

As mentioned in the prior section, we're going to assume you have the `config-management-operator` deployed to your GKE cluster as decscribed [here](https://cloud.google.com/anthos-config-management/docs/how-to/installing-config-sync#configuring-config-sync).

For the configuration of ACM beyond that, the following section includes a sample `configManagement` spec YAML that will get you up and running with minimal modification. 


##### 01-config-sync

Let's actually deploy the config sync, policy controller, and config connector bits first. There is a sample `config-management.yaml` in `01-config-sync/sample-config-management`. Tweak the cluster name if you wish, and apply it:

```
$ kubectl apply -f 01-config-sync/sample-config-management/config-management.yaml
configmanagement.configmanagement.gke.io/config-management created
```