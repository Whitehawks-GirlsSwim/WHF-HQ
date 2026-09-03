const APP_URL = './';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'WHF-HQ Update';
  const options = {
    body: payload.body || 'A new WHF Girls Swim & Dive update is available.',
    icon: 'app-icon.svg',
    badge: 'app-icon.svg',
    tag: payload.tag || 'whf-hq-update',
    renotify: true,
    data: { url: payload.url || APP_URL }
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    if ('setAppBadge' in self.navigator) await self.navigator.setAppBadge(1);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if ('clearAppBadge' in self.navigator) event.waitUntil(self.navigator.clearAppBadge());
  const destination = new URL(event.notification.data?.url || APP_URL, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.location.origin + '/WHF-HQ/'));
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(destination);
      return;
    }
    await self.clients.openWindow(destination);
  })());
});
