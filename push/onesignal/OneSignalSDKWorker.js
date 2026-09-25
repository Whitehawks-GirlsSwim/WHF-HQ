self.addEventListener("push", event => {
  event.waitUntil((async () => {
    if ("setAppBadge" in self.navigator) await self.navigator.setAppBadge(1);
  })());
});

self.addEventListener("notificationclick", event => {
  if ("clearAppBadge" in self.navigator) event.waitUntil(self.navigator.clearAppBadge());
});

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
