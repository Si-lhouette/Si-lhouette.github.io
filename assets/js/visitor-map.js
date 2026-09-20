(function () {
  const API_BASE = window.VISITOR_MAP_API;
  if (!API_BASE) return;

  const apiUrl = (path) => API_BASE.replace(/\/$/, "") + path;

  // Record this pageview once per browser session (avoids inflating counts
  // when someone clicks around multiple pages in one visit).
  try {
    if (!sessionStorage.getItem("visitor_map_tracked")) {
      fetch(apiUrl("/track"), { mode: "cors" }).catch(() => {});
      sessionStorage.setItem("visitor_map_tracked", "1");
    }
  } catch (e) {
    fetch(apiUrl("/track"), { mode: "cors" }).catch(() => {});
  }

  const regionNames = (() => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" });
    } catch (e) {
      return null;
    }
  })();

  function countryName(code) {
    if (!regionNames || !/^[A-Z]{2}$/.test(code)) return code;
    try {
      return regionNames.of(code) || code;
    } catch (e) {
      return code;
    }
  }

  function countryFlag(code) {
    if (!/^[A-Z]{2}$/.test(code)) return "";
    return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }

  function init() {
    const trigger = document.getElementById("visitor-map-trigger");
    const modal = document.getElementById("visitor-map-modal");
    if (!trigger || !modal) return;

    const bg = document.getElementById("visitor-map-bg");
    const dots = document.getElementById("visitor-map-dots");
    const countries = document.getElementById("visitor-map-countries");
    const caption = document.getElementById("visitor-map-caption");
    let loaded = false;

    function openModal() {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      if (!loaded) {
        loaded = true;
        if (bg.dataset.src) bg.src = bg.dataset.src;
        loadData();
      }
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }

    trigger.addEventListener("click", openModal);
    modal.querySelectorAll("[data-visitor-map-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    function loadData() {
      fetch(apiUrl("/map-data"), { mode: "cors" })
        .then((res) => res.json())
        .then(render)
        .catch(() => {
          caption.textContent = "Couldn't load visitor data.";
        });
    }

    function render(data) {
      const points = data.points || [];
      const svgNS = "http://www.w3.org/2000/svg";

      dots.textContent = "";
      points.forEach((p) => {
        const c = document.createElementNS(svgNS, "circle");
        c.setAttribute("cx", (p.lon + 180).toFixed(2));
        c.setAttribute("cy", (90 - p.lat).toFixed(2));
        c.setAttribute("r", Math.min(1.2 + Math.log2(p.count + 1) * 0.8, 5).toFixed(2));
        const t = document.createElementNS(svgNS, "title");
        t.textContent = p.city + ", " + countryName(p.country) + ": " + p.count;
        c.appendChild(t);
        dots.appendChild(c);
      });

      const byCountry = {};
      points.forEach((p) => {
        byCountry[p.country] = (byCountry[p.country] || 0) + p.count;
      });
      const ranked = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
      const max = ranked.length ? ranked[0][1] : 1;

      countries.textContent = "";
      ranked.slice(0, 10).forEach(([code, count]) => {
        const li = document.createElement("li");

        const name = document.createElement("span");
        name.className = "visitor-map-country-name";
        name.textContent = (countryFlag(code) + " " + countryName(code)).trim();

        const bar = document.createElement("span");
        bar.className = "visitor-map-country-bar";
        const fill = document.createElement("span");
        fill.style.width = ((count / max) * 100).toFixed(1) + "%";
        bar.appendChild(fill);

        const num = document.createElement("span");
        num.className = "visitor-map-country-count";
        num.textContent = count;

        li.append(name, bar, num);
        countries.appendChild(li);
      });

      caption.textContent = (data.total || 0) + " visits from " + ranked.length + " countries";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
