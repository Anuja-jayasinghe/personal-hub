/*
 * The hub's service worker (Notifications N.3, DECISIONS C140). It does two things only: shows an
 * act-now push, and opens the hub when one is tapped.
 *
 * It caches NOTHING: no fetch handler, no Cache Storage. The hub holds private data, and a cached page
 * could outlive a sign-out or show stale numbers. Served with `Cache-Control: no-cache` (next.config.ts)
 * so a new version is picked up at once.
 */

/** A path on the hub itself, or "/" (a push can never open another site). Kept pure so it can be tested. */
function safePath(href, origin) {
  if (typeof href !== "string" || href.length === 0 || href.length > 512) return "/";
  if (href.charAt(0) !== "/" || href.charAt(1) === "/" || href.charAt(1) === "\\" || /[\s\\]/.test(href)) return "/";
  try {
    var url = new URL(href, origin);
    if (url.origin !== origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

/** The payload is `{ title, body, href }`; anything missing gets a plain default. */
function readPush(data) {
  var payload = {};
  try {
    payload = data ? data.json() : {};
  } catch {
    payload = {};
  }
  var title = typeof payload.title === "string" && payload.title ? payload.title.slice(0, 120) : "hub";
  var body = typeof payload.body === "string" ? payload.body.slice(0, 600) : "";
  return { title: title, body: body, href: safePath(payload.href, self.location.origin) };
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var push = readPush(event.data);
  event.waitUntil(
    self.registration.showNotification(push.title, {
      body: push.body,
      icon: "/brand/hub-192.png",
      badge: "/brand/hub-192.png",
      data: { href: push.href },
      // One notification per place: a newer push about the same page replaces the older one.
      tag: push.href,
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var origin = self.location.origin;
  var href = safePath(event.notification.data && event.notification.data.href, origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        if (new URL(w.url).origin === origin && "focus" in w) {
          return w.focus().then(function (focused) {
            return focused && "navigate" in focused ? focused.navigate(origin + href) : focused;
          });
        }
      }
      return self.clients.openWindow(origin + href);
    }),
  );
});
