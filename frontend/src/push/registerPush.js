import { api } from '../api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function notificationPermission() {
  return pushSupported() ? Notification.permission : 'unsupported';
}

/**
 * Asks the user for notification permission (if not already decided) and,
 * if granted, subscribes this browser to Web Push and registers the
 * subscription with the backend against the currently logged-in user.
 * Safe to call repeatedly - it's a no-op once already subscribed.
 */
export async function enablePushNotifications() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const registration = await navigator.serviceWorker.ready;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = await api.pushPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  await api.pushSubscribe({ endpoint: json.endpoint, keys: json.keys });
  return { ok: true };
}

export async function disablePushNotifications() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await api.pushUnsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  }
}
