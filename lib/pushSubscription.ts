/**
 * Client-side Web Push subscription utilities.
 * Handles service worker registration, push subscription, and backend sync.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(authToken: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VAPID public key not configured');
    return false;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Push notifications not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    const subJson = subscription.toJSON();

    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        push_subscriptions: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          subscribed_at: new Date().toISOString(),
        },
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(authToken: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;

    const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    await fetch('/api/user', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        push_subscriptions: {},
      }),
    });

    return true;
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err);
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
