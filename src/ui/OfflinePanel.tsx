import { useEffect, useState } from "react";
export function OfflinePanel() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [update, setUpdate] = useState<ServiceWorker>();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration(import.meta.env.BASE_URL)
      .then((r) => {
        if (r?.active)
          setMessage("An offline version is installed on this device.");
        if (r?.waiting) setUpdate(r.waiting);
      });
  }, []);
  const prepare = async () => {
    setBusy(true);
    setMessage("Downloading this app and its pinned starter library…");
    try {
      if (!("serviceWorker" in navigator))
        throw Error(
          "Offline installation requires a supported browser on HTTPS.",
        );
      const registration = await navigator.serviceWorker.register(
        import.meta.env.BASE_URL + "service-worker.js",
        { scope: import.meta.env.BASE_URL, updateViaCache: "none" },
      );
      await registration.update();
      if (registration.waiting) {
        setUpdate(registration.waiting);
        setMessage("An updated offline version is ready.");
        return;
      }
      const installing = registration.installing;
      if (installing)
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                Error("Download is taking too long. Try again when connected."),
              ),
            60000,
          );
          const changed = () => {
            if (
              installing.state === "installed" ||
              installing.state === "activated"
            ) {
              clearTimeout(timer);
              installing.removeEventListener("statechange", changed);
              resolve();
            } else if (installing.state === "redundant") {
              clearTimeout(timer);
              installing.removeEventListener("statechange", changed);
              reject(
                Error(
                  "Offline download failed. Your saved projects are unchanged.",
                ),
              );
            }
          };
          installing.addEventListener("statechange", changed);
          changed();
        });
      if (registration.waiting) setUpdate(registration.waiting);
      setMessage(
        registration.waiting
          ? "An updated offline version is ready."
          : "Ready offline. This app, Play engine, PDF tools and starter library are downloaded.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h3>Use this device offline</h3>
      <p className="muted">
        Download the app and starter parts for offline use. Older installed
        versions are retained so saved projects keep their library files. Other
        official LDraw parts stay available offline once a model on this device
        has used them.
      </p>
      <button disabled={busy} onClick={() => void prepare()}>
        {busy ? "Downloading…" : "Download / check for updates"}
      </button>
      {update && (
        <button
          onClick={() => {
            update.postMessage({ type: "ACTIVATE_OFFLINE_UPDATE" });
            setUpdate(undefined);
            setMessage(
              "Update activated. Save your project, then reload to use it.",
            );
          }}
        >
          Activate downloaded update
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
