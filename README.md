# magda-function-template

An Openfass Serverless Function template for Magda. You can also use [faas-cli](https://github.com/openfaas/faas-cli) to create a Openfaas function. However, this template leverage our own toolset and works with our own deployment / CI system better.

> You can click the `Use this template` Github function button above to create a new repository from this template repository instead of forking it. More details see [Github Help Document: Creating a repository from a template](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-repository-from-a-template)

### Supply Your Own Function Code

You can supply your own function code in [`src/index.ts`](./src/index.ts). e.g.:

```typescript
export default async function myFunction(input: any) {
    return "hello world!\n";
}
```

> Invoke you function with `Content-Type: application/json` header will make your function receive unserialised data as input parameter.

### Install Project Dependencies

```bash
yarn install
```

### Build & Run Function in Minikube

-   Deploy Magda v0.0.57-0 or later
-   Build the function
    -   Run `yarn build`
-   Push docker image to minikube
    -   Run `eval $(minikube docker-env)`
    -   Run `yarn docker-build-local`
-   Deploy function to Minikube
    -   Make sure `namespacePrefix` field in [`deploy/minikube-dev.yaml`](./deploy/minikube-dev.yaml) contains correct `magda-core` deploy namespace. By default, it's `default` and it works if you've deployed Magda to `default` namespace.
    -   Run `yarn deploy-local`
-   Invoke your Function:
    -   Install [`faas-cli`](https://github.com/openfaas/faas-cli)
    -   Run `kubectl --namespace=[openfaas gateway namespace] port-forward svc/gateway 8080` to port-forward openfaas gateway
        -   Here, [openfaas gateway namespace] is `[magda-core namespace]-openfaas`. e.g. if magda is deployed to `default` namespace, `[openfaas gateway namespace]` would be `default-openfaas`
    -   Invoke by Run `echo "" | faas-cli faas-cli invoke magda-function-template`
    -   Alternatively, you can use [Postman](https://www.postman.com/) to send a HTTP Request (HTTP method doesn't matter here) to Magda gateway `/api/v0/openfaas/function/magda-function-template`

### Deploy with Magda

-   Add as Magda dependencies:

```yaml
- name: magda-function-template
  version: 0.0.57-0
  repository: https://charts.magda.io
  tags:
      - all
      - magda-function-template
```

-   Run `helm dep build` to pull the dependency
-   Deploy Magda

### Verify the function is deployed

-   Method One:
    -   Access Magda Gateway: `/api/v0/openfaas/system/function` with your web browser
        -   You might need Admin access to access this endpoint. However, you can disable the admin auth in Magda config.
-   Method Two:
    -   Run `kubectl --namespace=[openfaas function namespace] get functions`
        -   Here, [openfaas function namespace] is `[magda-core namespace]-openfaas-fn`. e.g. if magda is deployed to `default` namespace, `[openfaas function namespace]` would be `default-openfaas-fn`

> If the `Scale to Zero` option is set for the function (it's set to true by default), you won't see function pod in openfaas function namespace until you invoke the function

### CI Setup

This repo comes with script to build, test & release script to release docker image & helm chart to Magda repo. You need to setup the following Github action secrets to make it work:

-   `AWS_ACCESS_KEY_ID`: Magda helm chart repo S3 bucket access key
-   `AWS_SECRET_ACCESS_KEY`: Magda helm chart repo S3 bucket access key secret
-   `DOCKER_HUB_PASSWORD`: Magda docker hub bot password
-   `GITHUB_ACCESS_TOKEN`: Magda github bot access token
