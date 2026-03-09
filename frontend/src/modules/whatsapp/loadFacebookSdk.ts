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

let facebookSdkPromise: Promise<FacebookSDK> | null = null;
let initializedAppId: string | null = null;

function getFacebookWindow() {
  return window as FacebookWindow;
}

function initFacebookSdk(appId: string) {
  const fbWindow = getFacebookWindow();

  if (!fbWindow.FB) {
    throw new Error('Facebook SDK loaded without the expected global object.');
  }

  if (initializedAppId !== appId) {
    fbWindow.FB.init({
      appId,
      autoLogAppEvents: true,
      xfbml: false,
      version: 'v20.0',
    });
    initializedAppId = appId;
  }

  return fbWindow.FB;
}

export async function loadFacebookSdk(appId: string): Promise<FacebookSDK> {
  if (typeof window === 'undefined') {
    throw new Error('Facebook SDK can only load in the browser.');
  }

  const fbWindow = getFacebookWindow();

  if (fbWindow.FB && initializedAppId === appId) {
    return fbWindow.FB;
  }

  if (facebookSdkPromise) {
    return facebookSdkPromise;
  }

  facebookSdkPromise = new Promise<FacebookSDK>((resolve, reject) => {
    const resolveSdk = () => {
      try {
        resolve(initFacebookSdk(appId));
      } catch (error) {
        facebookSdkPromise = null;
        reject(error instanceof Error ? error : new Error('Failed to initialize the Facebook SDK.'));
      }
    };

    const handleError = () => {
      facebookSdkPromise = null;
      reject(new Error('Failed to load the Facebook SDK. Check network access and Meta app configuration.'));
    };

    fbWindow.fbAsyncInit = resolveSdk;

    const existingScript = document.getElementById(FACEBOOK_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      if (fbWindow.FB) {
        resolveSdk();
        return;
      }

      existingScript.addEventListener('load', resolveSdk, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = FACEBOOK_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = FACEBOOK_SDK_SRC;
    script.addEventListener('load', () => {
      if (fbWindow.FB) {
        resolveSdk();
      }
    }, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
}

export type { FacebookSDK };
