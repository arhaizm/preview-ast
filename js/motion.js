(() => {
  "use strict";
  const root = document.documentElement;
  const bay = document.querySelector(".bay");
  const detail = document.querySelector(".diagram");
  const scene = bay || detail;
  const control = document.querySelector(".motion-switch");
  const system = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reviewMode = new URLSearchParams(location.search).get("review") === "motion";
  let userPaused = false;
  let reviewReduced = false;
  let sceneVisible = false;
  let introPlayed = false;
  let replay = null;
  let wheelReplay = null;
  let reduceCheck = null;
  let detailSwitch = null;
  let sceneObserver = null;
  let sectionObserver = null;

  function reduced() { return system.matches || reviewReduced; }

  function moveAllowed() { return !reduced() && !userPaused; }

  function playIntro() {
    if (!scene || !sceneVisible || document.hidden || !moveAllowed()) return;
    introPlayed = true;
    const name = bay ? "intro-on" : "trace-on";
    scene.classList.remove(name);
    void scene.getBoundingClientRect();
    scene.classList.add(name);
  }

  function update() {
    const allowed = moveAllowed();
    root.toggleAttribute("data-motion-enabled", allowed);
    root.toggleAttribute("data-tab-hidden", document.hidden);
    root.toggleAttribute("data-system-reduced", system.matches);
    root.toggleAttribute("data-review-reduced", reviewReduced);
    root.toggleAttribute("data-user-paused", userPaused);
    root.toggleAttribute("data-scene-offscreen", Boolean(scene && !sceneVisible));
    root.dataset.motionState = system.matches ? "system-reduced" : reviewReduced ? "review-reduced" : userPaused ? "manual-pause" : document.hidden ? "document-hidden" : scene && !sceneVisible ? "offscreen" : bay ? "ambient-running" : "enabled";
    root.toggleAttribute("data-ambient-running", Boolean(bay && sceneVisible && !document.hidden && allowed));
    if (control) {
      control.disabled = reduced();
      control.setAttribute("aria-pressed", String(allowed));
      control.title = reduced() ? "Включено уменьшенное движение" : userPaused ? "Продолжить анимацию" : "Приостановить анимацию";
      control.querySelector(".motion-caption").textContent = reduced() ? "Без движения" : userPaused ? "Пуск" : "Пауза";
    }
    if (replay) replay.disabled = !allowed;
    if (wheelReplay) wheelReplay.disabled = !allowed;
    if (detailSwitch) {
      detailSwitch.disabled = reduced();
      detailSwitch.setAttribute("aria-pressed", String(allowed));
      detailSwitch.textContent = userPaused ? "Пуск" : "Пауза";
    }
    if (reduceCheck) {
      reduceCheck.disabled = system.matches;
      reduceCheck.checked = reduced();
    }
    if (!allowed) {
      scene?.classList.remove("intro-on", "trace-on");
      document.querySelectorAll(".reveal-on").forEach(node => node.classList.remove("reveal-on"));
    }
    if (allowed && !introPlayed && sceneVisible && !document.hidden) playIntro();
  }

  function setSceneVisible(visible) {
    sceneVisible = visible;
    update();
  }

  function togglePause() {
    if (reduced()) return;
    userPaused = !userPaused;
    try { sessionStorage.setItem("ast-motion-paused", userPaused ? "1" : "0"); } catch {}
    update();
  }
  try { userPaused = sessionStorage.getItem("ast-motion-paused") === "1"; } catch {}

  if (reviewMode && scene) {
    const panel = document.createElement("aside");
    panel.className = "motion-review";
    panel.setAttribute("aria-label", "Управление просмотром макета");
    panel.innerHTML = '<strong>Просмотр движения</strong><button type="button" class="replay-button">Повторить вступление</button><label class="review-check"><input type="checkbox">Без движения</label><a href="index.html">К обзору</a>';
    document.querySelector("header").after(panel);
    replay = panel.querySelector("button");
    reduceCheck = panel.querySelector("input");
    replay.addEventListener("click", () => {
      if (bay) bay.style.removeProperty("--entry-duration");
      playIntro();
    });
    if (bay) {
      wheelReplay = document.createElement("button");
      wheelReplay.type = "button";
      wheelReplay.className = "replay-button";
      wheelReplay.textContent = "Проверить колёса · ×¼ скорости";
      wheelReplay.addEventListener("click", () => {
        bay.style.setProperty("--entry-duration", "6.8s");
        playIntro();
      });
      replay.after(wheelReplay);
    }
    if (detail) {
      detailSwitch = document.createElement("button");
      detailSwitch.type = "button";
      detailSwitch.className = "replay-button";
      detailSwitch.setAttribute("aria-label", "Воспроизведение движения");
      detailSwitch.addEventListener("click", togglePause);
      replay.after(detailSwitch);
    }
    reduceCheck.addEventListener("change", () => { reviewReduced = reduceCheck.checked; update(); });
  }

  if (control) control.addEventListener("click", togglePause);
  if (system.addEventListener) system.addEventListener("change", update);
  else if (system.addListener) system.addListener(update);
  document.addEventListener("visibilitychange", update);
  window.addEventListener("pageshow", update);

  if (scene && "IntersectionObserver" in window) {
    sceneObserver = new IntersectionObserver(entries => setSceneVisible(entries[0].isIntersecting), {threshold: 0});
    sceneObserver.observe(scene);
  } else if (scene) {
    const checkScene = () => {
      const box = scene.getBoundingClientRect();
      setSceneVisible(box.bottom > 0 && box.top < innerHeight);
    };
    window.addEventListener("scroll", checkScene, {passive:true});
    window.addEventListener("resize", checkScene);
    checkScene();
  }
  if ("IntersectionObserver" in window) {
    sectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        sectionObserver.unobserve(entry.target);
        if (moveAllowed() && !document.hidden) entry.target.classList.add("reveal-on");
      }
    }, {threshold:0, rootMargin:"0px 0px -8% 0px"});
    document.querySelectorAll(".park-head,.more-title,.rent-info,.company-lead,.journal-head,.inquiry>div:first-child,.job>div:first-child,.attach .wrap,.order>div:first-child,.prose section").forEach(node => sectionObserver.observe(node));
  }
  root.setAttribute("data-motion-ready","");
  update();
  if (control) control.closest(".motion-toolbar").hidden = false;
})();