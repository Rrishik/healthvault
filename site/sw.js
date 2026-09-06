self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const destination = self.registration.scope;
      await self.registration.unregister();
      const tabs = await self.clients.matchAll({ type: 'window' });
      await Promise.all(
        tabs.map((tab) => tab.navigate(destination).catch(() => undefined)),
      );
    })(),
  );
});
