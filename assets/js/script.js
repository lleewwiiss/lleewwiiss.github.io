// return a random number within a range
function random(min, max) {
  return Math.random() * (max - min) + min;
}

// ColorPalette class
class ColorPalette {
  constructor() {
    this.setColors();
    this.setCustomProperties();
  }

  setColors() {
    // pick a random hue somewhere between 220 and 360
    this.hue = ~~random(220, 360);
    this.complimentaryHue1 = this.hue + 30;
    this.complimentaryHue2 = this.hue + 60;
    // define a fixed saturation and lightness
    this.saturation = 95;
    this.lightness = 50;
  }

  setCustomProperties() {
    // set CSS custom properties so that the colors defined here can be used throughout the UI
    document.documentElement.style.setProperty("--hue", this.hue);
    document.documentElement.style.setProperty(
      "--hue-complimentary1",
      this.complimentaryHue1
    );
    document.documentElement.style.setProperty(
      "--hue-complimentary2",
      this.complimentaryHue2
    );
  }
}

// Create colour palette
const colorPalette = new ColorPalette();

document
  .querySelector(".overlay__btn--colors")
  .addEventListener("click", () => {
    colorPalette.setColors();
    colorPalette.setCustomProperties();
  });

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function syncAnimationState() {
  document.body.classList.toggle(
    "animations-paused",
    document.hidden || reducedMotion.matches
  );
}

document.addEventListener("visibilitychange", syncAnimationState);

if (typeof reducedMotion.addEventListener === "function") {
  reducedMotion.addEventListener("change", syncAnimationState);
} else {
  reducedMotion.addListener(syncAnimationState);
}

syncAnimationState();
