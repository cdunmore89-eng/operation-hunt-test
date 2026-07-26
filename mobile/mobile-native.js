"use strict";

(function initializeNativeShell() {
  const root = document.documentElement;
  const body = document.body;

  root.classList.add("operation-hunt-mobile");

  const capacitor = window.Capacitor;
  const isNative = Boolean(
    capacitor &&
    typeof capacitor.isNativePlatform === "function" &&
    capacitor.isNativePlatform()
  );

  root.classList.toggle("capacitor-native", isNative);
  root.classList.toggle("capacitor-web-preview", !isNative);

  function updateVisibilityState() {
    const backgrounded = document.visibilityState === "hidden";

    body.classList.toggle("app-backgrounded", backgrounded);

    window.dispatchEvent(
      new CustomEvent("operationhunt:visibilitychange", {
        detail: {
          backgrounded,
          visibilityState: document.visibilityState
        }
      })
    );
  }

  function getClosestControl(target, selector) {
    return target instanceof Element
      ? target.closest(selector)
      : null;
  }

  document.addEventListener(
    "visibilitychange",
    updateVisibilityState
  );

  document.addEventListener("contextmenu", event => {
    const interactiveControl = getClosestControl(
      event.target,
      "button, .puzzle-board, .timer-switch"
    );

    if (interactiveControl) {
      event.preventDefault();
    }
  });

  document.addEventListener("dragstart", event => {
    const draggableGameControl = getClosestControl(
      event.target,
      "button, .puzzle-board"
    );

    if (draggableGameControl) {
      event.preventDefault();
    }
  });

  updateVisibilityState();
})();
