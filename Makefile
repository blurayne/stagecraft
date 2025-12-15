include .env-common
include .env
SHELL := /bin/bash -eEuo pipefail -c

# :dev-latest is intended to be the latest development image (pulled or built on local)
# :latest is intended to be used in non-prod environments
# :v1.x is inteded to be used in prod environments (as release is deployed)

init:
	npm install -g playwright --install-links
	npx playwright install chromium
	npm install -g @vercel/ncc --force

build-app-ts:
	# esModuleInterop:true in tsconfig.json seems to be ingored
	# https://www.typescriptlang.org/tsconfig
	tsc -w --esModuleInterop index.ts

clean-npm-cache:
	npm cache clean --force

build-app-ncc:
	NODE_OPTIONS=--openssl-legacy-provider ncc build index.ts -o $(PWD)/dist

# Build release image :latest
# will stay local until pushed
build-release:
	docker build \
		--target main \
		--squash \
		--tag $(OCI_WEB_REPO):latest \
		-f Containerfile \
		.

# Build dev image :dev-latest
# will stay local until pushed
build-dev:
	docker build \
		--target dev \
		--tag $(OCI_WEB_REPO):dev-latest \
		-f Containerfile \
		.

# Test release image
# this image has everything on board to run the app - don't DO volume mounts (except for secrets ;)!
test-release:
	 docker run -it --rm --env-file .env -p 5006:5006 $(OCI_WEB_REPO):latest

# Push current :dev-latest and :latest
# no version tag is pushed here
push-latest:
		docker push $(OCI_WEB_REPO):latest

# Push current :dev-latest and :latest
# no version tag is pushed here
push-dev-latest:
	docker push $(OCI_WEB_REPO):dev-latest


# Pulls :dev-latest
pull-dev-latest:
	docker pull $(OCI_WEB_REPO):dev-latest

# Pulls :dev-latest
pull-latest:
	docker pull $(OCI_WEB_REPO):latest

# start dev-server and mount current working path
# forword port
dev:
	docker run -it --rm --env-file .env  \
		-v $$PWD:/app \
		-p 5006:5006 \
		$(OCI_WEB_REPO):dev-latest \
		"python3" "/app/app.py"

# Publish a new version/overwrite version
# version tag is published here
# :latest and :dev-latest need to be up-to-date here!
publish: push-latest push-dev-latest push-latest
	docker tag $(OCI_WEB_REPO):latest \
		$(OCI_WEB_REPO):$(VERSION)
	docker tag $(OCI_WEB_REPO):dev-latest \
		$(OCI_WEB_REPO):dev-$(VERSION)
	docker push $(OCI_WEB_REPO):$(VERSION)
	docker push $(OCI_WEB_REPO):dev-$(VERSION)


# Before overwriting :latest or :dev-latest we make backups in remote registry
# uses https://github.com/containers/skopeo
backup-latest:
	$(eval DATE_TAG := $(shell date +"%Y%m%d-%H%M%S"))
	skopeo copy docker://$(OCI_WEB_REPO):latest docker://$(OCI_WEB_REPO):latest-$(DATE_TAG)
	skopeo copy docker://$(OCI_WEB_REPO):dev-latest docker://$(OCI_WEB_REPO):latest-$(DATE_TAG)
