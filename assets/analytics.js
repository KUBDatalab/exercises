/* Set to the endpoint from your own GoatCounter account to enable statistics. */
const GOATCOUNTER_ENDPOINT = "https://kubdatalab.goatcounter.com/count";
(() => {
  if (!GOATCOUNTER_ENDPOINT || location.hostname !== "kubdatalab.github.io") return;
  // Deliberately send no query parameters, fragments, referrer or exercise answers.
  window.goatcounter = {
    path: () => location.pathname,
    referrer: () => ""
  };
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = GOATCOUNTER_ENDPOINT;
  document.head.appendChild(script);
})();
