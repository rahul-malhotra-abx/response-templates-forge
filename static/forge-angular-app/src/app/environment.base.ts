const environments = {
  RESPONSE_TEMPLATE_PRO: {
    APP_NAME: 'Response Template Pro',
    APP_MODE: 'RESPONSE_TEMPLATE_PRO',
    APP_KEY: 'com.appbox.ai.response.templates',
    APP_BASE_KEY: 'com.appbox.ai.response.templates',
    // Same-origin, so the app declares no egress.
    EDITOR_APP_BASE_PATH: './assets/editor/index.html',
    EDITOR_IFRAME_CHANNEL: 'iframed.react',
    FREE_VERSION: false,
    PAID_VERSION: true,
  },
  RESPONSE_TEMPLATE_FREE: {
    APP_NAME: 'Response Template Free',
    APP_MODE: 'RESPONSE_TEMPLATE_FREE',
    APP_KEY: 'com.appbox.ai.response.templates.free',
    APP_BASE_KEY: 'com.appbox.ai.response.templates',
    EDITOR_APP_BASE_PATH: './assets/editor/index.html',
    EDITOR_IFRAME_CHANNEL: 'iframed.react',
    FREE_VERSION: true,
    PAID_VERSION: false,
  },
};

type EnvironmentMode = keyof typeof environments;

export function getEnvironment(mode: EnvironmentMode) {
  return environments[mode];
}
