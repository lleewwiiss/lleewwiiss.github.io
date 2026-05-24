// return a random number within a range
function random(min, max) {
  return Math.random() * (max - min) + min;
}

function debounce(callback, delay = 150) {
  let timeout;

  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), delay);
  };
}

function hsla(hue, saturation, lightness, alpha) {
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
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
    this.colorChoices = [
      this.hue,
      this.complimentaryHue1,
      this.complimentaryHue2
    ];
  }

  randomHue() {
    return this.colorChoices[~~random(0, this.colorChoices.length)];
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
const canvas = document.querySelector(".orb-canvas");
const context = canvas.getContext("2d", { alpha: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let width = 0;
let height = 0;
let animationFrame;
let isAnimating = false;
let orbs = [];

function createOrb(index) {
  const size = Math.max(width, height);
  const originX = width * random(0.18, 0.92);
  const originY = height * random(0.12, 0.9);

  return {
    hue: colorPalette.randomHue(),
    originX,
    originY,
    radius: random(size * 0.12, size * 0.24),
    travelX: random(size * 0.08, size * 0.18) * (index % 2 ? -1 : 1),
    travelY: random(size * 0.08, size * 0.18) * (index % 3 ? 1 : -1),
    phase: random(0, Math.PI * 2),
    speedX: random(0.36, 0.68),
    speedY: random(0.3, 0.58),
    scaleSpeed: random(0.24, 0.44),
    alpha: random(0.46, 0.72)
  };
}

function createOrbs() {
  const orbCount = width < 700 ? 6 : 9;
  orbs = Array.from({ length: orbCount }, (_, index) => createOrb(index));
}

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  createOrbs();
  render(performance.now());
}

function drawOrb(orb, time) {
  const seconds = time / 1000;
  const scale = 0.82 + Math.sin(seconds * orb.scaleSpeed + orb.phase) * 0.18;
  const x = clampPosition(
    orb.originX + Math.cos(seconds * orb.speedX + orb.phase) * orb.travelX,
    orb.radius,
    width
  );
  const y = clampPosition(
    orb.originY + Math.sin(seconds * orb.speedY + orb.phase * 1.4) * orb.travelY,
    orb.radius,
    height
  );
  const radius = orb.radius * scale;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

  gradient.addColorStop(0, hsla(orb.hue, colorPalette.saturation, 72, orb.alpha));
  gradient.addColorStop(0.42, hsla(orb.hue, colorPalette.saturation, 58, orb.alpha * 0.7));
  gradient.addColorStop(1, hsla(orb.hue, colorPalette.saturation, 58, 0));

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function clampPosition(value, radius, max) {
  return Math.max(-radius * 0.35, Math.min(value, max + radius * 0.35));
}

function render(time) {
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "screen";

  orbs.forEach((orb) => drawOrb(orb, time));

  context.globalCompositeOperation = "source-over";
}

function animate(time) {
  if (!isAnimating) {
    return;
  }

  render(time);
  animationFrame = window.requestAnimationFrame(animate);
}

function syncAnimationState() {
  const shouldAnimate = !document.hidden && !reducedMotion.matches;

  if (shouldAnimate && !isAnimating) {
    isAnimating = true;
    animationFrame = window.requestAnimationFrame(animate);
  }

  if (!shouldAnimate && isAnimating) {
    isAnimating = false;
    window.cancelAnimationFrame(animationFrame);
    render(performance.now());
  }
}

document
  .querySelector(".overlay__btn--colors")
  .addEventListener("click", () => {
    colorPalette.setColors();
    colorPalette.setCustomProperties();

    orbs.forEach((orb) => {
      orb.hue = colorPalette.randomHue();
    });

    render(performance.now());
  });

document.addEventListener("visibilitychange", syncAnimationState);
window.addEventListener("resize", debounce(resizeCanvas));

if (typeof reducedMotion.addEventListener === "function") {
  reducedMotion.addEventListener("change", syncAnimationState);
} else {
  reducedMotion.addListener(syncAnimationState);
}

resizeCanvas();
syncAnimationState();
