# Repository migration log

## 1. Generate appropriate `.gitignore`

```bash
rm -f .gitignore
cat <<EOF > .gitignore
# --------------------------------------------------
# Node.JS
# --------------------------------------------------
$(curl -fsSL https://raw.githubusercontent.com/github/gitignore/refs/heads/main/Node.gitignore)

# --------------------------------------------------
# Terraform/OpenTofu
# --------------------------------------------------
$(curl -fsSL https://raw.githubusercontent.com/github/gitignore/refs/heads/main/Terraform.gitignore)
EOF
```

## 2. Download repo tools

```bash
# Download root package.json
curl -O https://raw.githubusercontent.com/backstage/community-plugins/refs/heads/main/package.json
curl -O https://raw.githubusercontent.com/backstage/community-plugins/refs/heads/main/yarn.lock

corepack enable
yarn install
yarn set version 4
yarn install

VERSION="main"
mkdir -p .tmp/community-plugins/${VERSION}
curl -fsSL https://github.com/backstage/community-plugins/archive/refs/heads/${VERSION}.tar.gz \
    | tar -xvzf - \
    --strip-components=1 \
    --directory=.tmp/community-plugins/${VERSION} \
    community-plugins-${VERSION/"/"/"-"}/workspaces

rsync -av \
        .tmp/community-plugins/${VERSION/"/"/"-"}/workspaces/repo-tools \
        ./workspaces/

rm -rf .tmp/
```

## 3. Create Harmonix workspace

Install AWS Harmonix Backstage distribution.

```bash
build-script/backstage-install.sh
```

Create the `harmonix` workspace.

```bash
yarn create-workspace
```
## 4. Move Harmonix App

Move the AWS Harmonix customized Backstage App to the `harmonix` workspace, and add new scripts required by the CI process

```bash
rsync -av backstage/* workspaces/harmonix/
rsync -av backstage-plugins/plugins/* workspaces/harmonix/plugins/

yq -p json -o json -i '
.scripts."build:api-reports" = "yarn build:api-reports:only --tsc" |
.scripts."build:api-reports:only" = "backstage-repo-tools api-reports -o ae-wrong-input-file-type,ae-undocumented --validate-release-tags" |
.scripts.postinstall = "cd ../../ && yarn install"
' workspaces/harmonix/package.json

rm -rf backstage/
```

## 5.Move scaffolder templates

Move AWS Harmonix Scaffolder templates to the `software-templates/scaffolder-templates` directory

```bash
mkdir --parent \
  software-templates/scaffolder-templates \
  software-templates/skeletons/cdk \
  software-templates/skeletons/terraform \
  software-templates/skeletons/gitlab \
  software-templates/skeletons/github

rsync -av \
  backstage-reference/templates/* \
  software-templates/scaffolder-templates/

rsync -av \
  backstage-reference/common/* \
  software-templates/skeletons/

rm -rf software-templates/skeletons/cdk/*
mv -f software-templates/skeletons/aws_* \
   software-templates/skeletons/cdk/

rm -rf software-templates/skeletons/gitlab/*
mv -f software-templates/skeletons/cicd \
   software-templates/skeletons/gitlab/

rm -rf software-templates/skeletons/terraform/*
mv -f software-templates/skeletons/tf_aws_* \
   software-templates/skeletons/terraform/
```

## 6. Move IaC/Environment workspaces

Move CDK based Environment provider to the `harmonix` workspace, and include them in the list of the Yarn support workspaces.

```bash
rm -rf workspaces/harmonix/platforms/*
rsync -av \
  iac/roots/* \
  workspaces/harmonix/platforms/

for name in workspaces/harmonix/platforms/opa-*; do
  mv -f "${name}" "workspaces/harmonix/platforms/${name#*-}"
done

mv -f workspaces/harmonix/platforms/platform \
  workspaces/harmonix/platforms/installer

rm -f \
  workspaces/harmonix/platforms/package.json \
  workspaces/harmonix/platforms/README.md \
  workspaces/harmonix/platforms/tsconfig.json \
  workspaces/harmonix/platforms/yarn.lock

yq -p json -o json -i '
.workspaces.packages += "platforms/*"
' workspaces/harmonix/package.json

yq -p json -o json -i '
.include += "platforms/*/src"
' workspaces/harmonix/tsconfig.json
```

## 7. Rename `build-script` to `hack`

The `build-script` directory mainly contains scripts to be invoked locally by the operator, thus it is best to rename this directory has `hack` to avoid confusion with `scripts` directory usually assciated with pipelines.

```bash
rm -rf hack/
rsync -va build-script/* hack/
cp config/app-config.aws-production.yaml workspaces/aws/

mkdir -p containers/harmonix
cp config/aws-production.Dockerfile /Dockerfile
rsync -va config/* workspaces/harmonix/


EXPRESSIONS=( \
  "s|opaHomeDir=\$biScriptDir\/\.\.|opaHomeDir=\$biScriptDir/workspaces/harmonix|g" \
  "s|backstageDir=\$opaHomeDir\/backstage|backstageDir=\$opaHomeDir|g" \
  "s|\(cp\s-R\s\$opaHomeDir\/backstage-plugins/\s\$backstageDir\)|#\1|g" \
  "s|backstageDir=\${scriptDir}\/\.\.\/backstage|backstageDir=\${scriptDir}/workspaces/harmonix|g" \
  "s|configDir=\${scriptDir}\/\.\.\/config|backstageDir=\${scriptDir}/workspaces/harmonix|g" \
  "s|iacDir=\$scriptDir\/\.\.\/iac\/roots|iacDir=\$scriptDir/workspaces/aws/platforms|g" \
  "s|backstageDir=\$buildScriptDir\/\.\.\/backstage|backstageDir=\$buildScriptDir/workspaces/aws|g" \
  "s|backstageIacDir=\$buildScriptDir\/\.\.\/iac\/roots\/opa-platform|backstageIacDir=\$buildScriptDir/workspaces/aws/platforms/installer|g" \
  "s|iacDir=\${scriptDir}\/\.\.\/iac\/roots|iacDir=\${scriptDir}/workspaces/aws/platforms|g" \
  "s|opaPlatformDir=\${iacDir}\/opa-platform|opaPlatformDir=\${iacDir}/installer|g" \
  "s|backstageDir=\$appRootDir\/backstage|backstageDir=\$appRootDir/workspace/aws|g" \
  "s|configDir=\$scriptDir\/\.\.\/config|configDir=\$scriptDir/../workspaces/aws|g" \
)

for exp in ${EXPRESSIONS[@]}
do
  find hack/ -type f -name '*.sh' -exec \
  bash -c "sed -i '${exp}' {}" \;
done
```
