/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { CatalogClient } from '@backstage/catalog-client';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import {
  createRepoAccessTokenAction,
  createSecretAction,
  createS3BucketAction,
  getEnvProvidersAction,
  getComponentInfoAction,
  getSsmParametersAction,
  getPlatformParametersAction,
  getPlatformMetadataAction,
} from '@aws/plugin-scaffolder-backend-aws-apps-for-backstage';
import { ScmIntegrations } from '@backstage/integration';
import { OktaOrgEntityProvider } from '@roadiehq/catalog-backend-module-okta';
import { createAppendFileAction, createWriteFileAction } from '@roadiehq/scaffolder-backend-module-utils';
import { customOktaAuth } from './plugins/CustomOktaAuth';
import oktaCatalogBackendModule, { EntityProviderFactory, oktaCatalogBackendEntityProviderFactoryExtensionPoint } from '@roadiehq/catalog-backend-module-okta/new-backend';
import { loggerToWinstonLogger } from '@backstage/backend-common';
import { createGitlabGroupEnsureExistsAction, createGitlabIssueAction, createGitlabProjectAccessTokenAction, createGitlabProjectDeployTokenAction, createGitlabProjectVariableAction, createGitlabRepoPushAction, createPublishGitlabAction, createPublishGitlabMergeRequestAction, createTriggerGitlabPipelineAction, editGitlabIssueAction } from '@backstage/plugin-scaffolder-backend-module-gitlab';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { OpaSamplePermissionPolicy } from './plugins/OpaSamplePermissionPolicy';
import { AnnotateScmSlugEntityProcessor } from '@backstage/plugin-catalog-backend';
import { gitlabPlugin,  catalogPluginGitlabFillerProcessorModule,} from '@immobiliarelabs/backstage-plugin-gitlab-backend'
// import { getRootLogger, legacyPlugin, loadBackendConfig, loggerToWinstonLogger, useHotMemoize } from '@backstage/backend-common';
// import { PluginEnvironment } from './types';
// import catalog from './plugins/catalog';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend/alpha'));
backend.add(import('@backstage/plugin-proxy-backend/alpha'));
backend.add(import('@backstage/plugin-scaffolder-backend/alpha'));
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-gitlab'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));

// Temp fix until @backstage/plugin-scaffolder-backend-module-gitlab will create a plugin.ts


export const gitlabModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'gitlab',
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder, config }) {
        const integrations = ScmIntegrations.fromConfig(config);

        scaffolder.addActions(
          createGitlabGroupEnsureExistsAction({ integrations }),
          createGitlabIssueAction({ integrations }),
          createGitlabProjectAccessTokenAction({ integrations }),
          createGitlabProjectDeployTokenAction({ integrations }),
          createGitlabProjectVariableAction({ integrations }),
          createGitlabRepoPushAction({ integrations }),
          editGitlabIssueAction({ integrations }),
          createPublishGitlabAction({ config, integrations }),
          createPublishGitlabMergeRequestAction({ integrations }),
          createTriggerGitlabPipelineAction({ integrations }),
        );
      },
    });
  },
});



// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
// backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// See https://backstage.io/docs/auth/guest/provider

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend/alpha'));
backend.add(import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'));
backend.add(import('@backstage/plugin-catalog-backend-module-gitlab/alpha'));
backend.add(import('@backstage/plugin-catalog-backend-module-github/alpha'));


// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend/alpha'));
backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));

// search plugin
backend.add(import('@backstage/plugin-search-backend/alpha'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg/alpha'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs/alpha'));

// OPA AWS backend Plugin
backend.add(import('@aws/plugin-aws-apps-backend-for-backstage'));

// OPA Custom AWS Entities processors
backend.add(import('@aws/backstage-plugin-catalog-backend-module-aws-apps-entities-processor'));



// Loading Okta catalog - using new backend - bug - awaiting for fix: https://github.com/RoadieHQ/roadie-backstage-plugins/issues/1537
export const oktaCatalogBackendModuleCustom = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'okta-entity-provider-custom',
  register(env) {
    env.registerInit({
      deps: {
        provider: oktaCatalogBackendEntityProviderFactoryExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ provider, logger, config }) {
        const factory: EntityProviderFactory = () =>
          OktaOrgEntityProvider.fromConfig(config, {
            logger: loggerToWinstonLogger(logger),
            userNamingStrategy: 'strip-domain-email',
            groupNamingStrategy: 'kebab-case-name',
          });

        provider.setEntityProviderFactory(factory);
      },
    });
  },
});

backend.add(oktaCatalogBackendModuleCustom);
// Temp fix until roadiehq will update the plugin
const oktaBackendFeature = oktaCatalogBackendModule;
backend.add(oktaBackendFeature());
// backend.add(import('@roadiehq/catalog-backend-module-okta/new-backend'));



// import('@roadiehq/catalog-backend-module-okta/new-backend').then(module => {
//   let backendFeature = module.default
//   backend.add(backendFeature());
// });



// End of Loading Okta catalog


// Loading OKTA users and groups - Legacy code:
// backend.add(legacyPlugin('catalog', import('./plugins/catalog')));

// OKTA provider
backend.add(customOktaAuth);
// backend.add(import('@backstage/plugin-auth-backend-module-okta-provider'));

// Load custom scaffolder actions
const scaffolderModuleAWSCustomExtensions = createBackendModule({
  pluginId: 'scaffolder', // name of the plugin that the module is targeting
  moduleId: 'aws-apps',
  register(env) {
  
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery
      },
      async init({ scaffolder, config, discovery }) {
        // Here you have the opportunity to interact with the extension
        // point before the plugin itself gets instantiated
        const integrations = ScmIntegrations.fromConfig(config);
        const catalogClient = new CatalogClient({
          discoveryApi: discovery,
        });

        scaffolder.addActions(createWriteFileAction())
        scaffolder.addActions(createAppendFileAction())
        // scaffolder.addActions(createZipAction())
        // scaffolder.addActions(createSleepAction())
        // scaffolder.addActions(createMergeJSONAction())
        // scaffolder.addActions(createMergeAction())
        // scaffolder.addActions(createParseFileAction())
        // scaffolder.addActions(createSerializeYamlAction())
        // scaffolder.addActions(createSerializeJsonAction())
        // scaffolder.addActions(createJSONataAction())
        // scaffolder.addActions(createYamlJSONataTransformAction())
        // scaffolder.addActions(createJsonJSONataTransformAction())
        // scaffolder.addActions(createReplaceInFileAction())
        scaffolder.addActions(createS3BucketAction())
        scaffolder.addActions(createSecretAction({envConfig:config}))
        scaffolder.addActions(getEnvProvidersAction({ catalogClient }))
        scaffolder.addActions(getComponentInfoAction())
        scaffolder.addActions(getSsmParametersAction())
        scaffolder.addActions(getPlatformMetadataAction({envConfig:config}))
        scaffolder.addActions(getPlatformParametersAction({envConfig:config}))
        scaffolder.addActions( createRepoAccessTokenAction({integrations, envConfig:config}));
      },
    });
  },
});

backend.add(scaffolderModuleAWSCustomExtensions);

// OPA permission policy sample

const opaCustomPolicy =  createBackendModule({
  pluginId: 'permission',
  moduleId: 'custom-opa-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new OpaSamplePermissionPolicy());
      },
    });
  },
});
console.log("Loaded: " + opaCustomPolicy.name)
// backend.add(opaCustomPolicy);

// Custom annotator
const catalogModuleCustomExtensions = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'custom-extensions',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
     
      },
      async init({ catalog, config }) {
        catalog.addProcessor(AnnotateScmSlugEntityProcessor.fromConfig(config))
      },
    });
  },
});
backend.add(catalogModuleCustomExtensions);
backend.add(gitlabPlugin);
backend.add(catalogPluginGitlabFillerProcessorModule);


backend.start();
