type FacebookSDK = {
  init: (config: Record<string, unknown>) => void;
  login: (
    callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
    options?: Record<string, unknown>
  ) => void;
};

type FacebookWindow = Window & {
  FB?: FacebookSDK;
  fbAsyncInit?: () => void;
};

const FACEBOOK_SCRIPT_ID = 'facebook-jssdk';
const FACEBOOK_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const DEFAULT_FACEBOOK_GRAPH_API_VERSION = 'v22.0';
const FACEBOOK_SDK_TIMEOUT_MS = 15000;

let facebookSdkPromise: Promise<FacebookSDK> | null = null;
let initializedAppId: string | null = null;
let initializedGraphApiVersion: string | null = null;

function getFacebookWindow() {
  return window as FacebookWindow;
}



function getFacebookGraphApiVersion() {
  const configuredVersion = import.meta.env.VITE_META_GRAPH_API_VERSION;
  const normalizedVersion = String(configuredVersion || DEFAULT_FACEBOOK_GRAPH_API_VERSION).trim();

  if (/^v\d+\.\d+$/.test(normalizedVersion)) {
    return normalizedVersion;
  }

  if (/^\d+\.\d+$/.test(normalizedVersion)) {
    return `v${normalizedVersion}`;
  }

  throw new Error(
    'Meta SDK configuration is invalid. Set VITE_META_GRAPH_API_VERSION to a supported Graph API version, for example v22.0.'
  );
}

function getFacebookSdkInitError(error: unknown, graphApiVersion: string) {
  const message = error instanceof Error ? error.message : 'Failed to initialize the Facebook SDK.';

  if (message.toLowerCase().includes('valid version')) {
    return new Error(
      `Meta rejected Graph API version ${graphApiVersion}. Update VITE_META_GRAPH_API_VERSION to a supported version and restart the frontend.`
    );
  }

  return error instanceof Error ? error : new Error(message);
}

function initFacebookSdk(appId: string, graphApiVersion: string) {
  const fbWindow = getFacebookWindow();

  if (!fbWindow.FB) {
    throw new Error('Facebook SDK loaded without the expected global object.');
  }

  if (initializedAppId !== appId || initializedGraphApiVersion !== graphApiVersion) {
    try {
      fbWindow.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: graphApiVersion,
      });
    } catch (error) {
      throw getFacebookSdkInitError(error, graphApiVersion);
    }

    initializedAppId = appId;
    initializedGraphApiVersion = graphApiVersion;
  }

  return fbWindow.FB;
}

export async function loadFacebookSdk(appId: string): Promise<FacebookSDK> {
  if (typeof window === 'undefined') {
    throw new Error('Facebook SDK can only load in the browser.');
  }

  const fbWindow = getFacebookWindow();
  const graphApiVersion = getFacebookGraphApiVersion();

  if (
    fbWindow.FB
    && initializedAppId === appId
    && initializedGraphApiVersion === graphApiVersion
  ) {
    return fbWindow.FB;
  }

  if (facebookSdkPromise) {
    return facebookSdkPromise;
  }

  facebookSdkPromise = new Promise<FacebookSDK>((resolve, reject) => {
    const existingAsyncInit = fbWindow.fbAsyncInit;
    const timeoutId = window.setTimeout(() => {
      fbWindow.fbAsyncInit = existingAsyncInit;
      facebookSdkPromise = null;
      reject(new Error('Timed out while loading the Facebook SDK. Check your network connection and Meta app configuration.'));
    }, FACEBOOK_SDK_TIMEOUT_MS);

    const resolveSdk = () => {
      try {
        window.clearTimeout(timeoutId);
        fbWindow.fbAsyncInit = existingAsyncInit;
        resolve(initFacebookSdk(appId, graphApiVersion));
      } catch (error) {
        window.clearTimeout(timeoutId);
        fbWindow.fbAsyncInit = existingAsyncInit;
        facebookSdkPromise = null;
        reject(error instanceof Error ? error : new Error('Failed to initialize the Facebook SDK.'));
      }
    };

    const handleError = () => {
      window.clearTimeout(timeoutId);
      fbWindow.fbAsyncInit = existingAsyncInit;
      facebookSdkPromise = null;
      reject(new Error('Failed to load the Facebook SDK. Check network access and Meta app configuration.'));
    };

    fbWindow.fbAsyncInit = () => {
      if (typeof existingAsyncInit === 'function') {
        existingAsyncInit();
      }
      resolveSdk();
    };

    const existingScript = document.getElementById(FACEBOOK_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      if (fbWindow.FB) {
        resolveSdk();
        return;
      }

      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = FACEBOOK_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = FACEBOOK_SDK_SRC;
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
}

export type { FacebookSDK };
