import { createBackendModule } from '@backstage/backend-plugin-api';
import { oktaAuthenticator } from '@backstage/plugin-auth-backend-module-okta-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { stringifyEntityRef, DEFAULT_NAMESPACE } from '@backstage/catalog-model';

export const customOktaAuth = createBackendModule({
  // This ID must be exactly "auth" because that's the plugin it targets
  pluginId: 'auth',
  // This ID must be unique, but can be anything
  moduleId: 'custom-auth-provider',
  register(reg) {
    reg.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          // This ID must match the actual provider config, e.g. addressing
          // auth.providers.okta means that this must be "okta".
          providerId: 'okta',
          // Use createProxyAuthProviderFactory instead if it's one of the proxy
          // based providers rather than an OAuth based one
          factory: createOAuthProviderFactory({
            authenticator: oktaAuthenticator,
            async signInResolver(info, ctx) {
              const { profile: { email } } = info;
              if (!email) {
                  throw new Error(
                    'Login failed, user profile does not contain an email',
                  );
              }
              // Split the email into the local part and the domain.
              const [localPart] = email.split('@');

              let fullProfileJson = (info.result.fullProfile as any)._json;
              let departmentName = "";
              if(fullProfileJson.department) {
                departmentName = fullProfileJson.department.replace('/[^a-zA-Z0-9]/g','-').replace('/-+/g','-').substring(1,62).toLowerCase();
              }
          
              // By using `stringifyEntityRef` we ensure that the reference is formatted correctly
              const userEntity = stringifyEntityRef({
                  kind: 'User',
                  name: localPart,
                  namespace: DEFAULT_NAMESPACE,
              });
              return ctx.issueToken({
                  claims: {
                      sub: userEntity,
                      ent: ["group:" + departmentName],
                  },
              });
            },
          }),
        });
      },
    });
  },
});