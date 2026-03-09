declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-sdk';
const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let razorpayPromise: Promise<NonNullable<Window['Razorpay']>> | null = null;

export async function loadRazorpayCheckout(): Promise<NonNullable<Window['Razorpay']>> {
  if (typeof window === 'undefined') {
    throw new Error('Razorpay checkout can only load in the browser.');
  }

  if (window.Razorpay) {
    return window.Razorpay;
  }

  if (razorpayPromise) {
    return razorpayPromise;
  }

  razorpayPromise = new Promise<NonNullable<Window['Razorpay']>>((resolve, reject) => {
    const resolveSdk = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }

      razorpayPromise = null;
      reject(new Error('Razorpay SDK loaded without exposing window.Razorpay.'));
    };

    const handleError = () => {
      razorpayPromise = null;
      reject(new Error('Failed to load Razorpay checkout SDK.'));
    };

    const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }

      existingScript.addEventListener('load', resolveSdk, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = RAZORPAY_SCRIPT_ID;
    script.async = true;
    script.src = RAZORPAY_SCRIPT_SRC;
    script.addEventListener('load', resolveSdk, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);
  });

  return razorpayPromise;
}

export function unloadRazorpayCheckout() {
  if (typeof window === 'undefined') {
    return;
  }

  razorpayPromise = null;

  const script = document.getElementById(RAZORPAY_SCRIPT_ID);
  if (script) {
    script.remove();
  }

  try {
    delete window.Razorpay;
  } catch {
    window.Razorpay = undefined;
  }
}
