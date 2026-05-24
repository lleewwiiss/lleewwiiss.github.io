import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@6.5.3/dist/browser/pixi.min.mjs";
import { createNoise2D } from "https://cdn.jsdelivr.net/npm/simplex-noise@4.0.0/dist/esm/simplex-noise.js";

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

function hslToNumber(hue, saturation, lightness) {
  lightness /= 100;
  const a = (saturation * Math.min(lightness, 1 - lightness)) / 100;
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    return lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };

  return (~~(f(0) * 255) << 16) + (~~(f(8) * 255) << 8) + ~~(f(4) * 255);
}

// map a number from 1 range to another
function map(n, start1, end1, start2, end2) {
  return ((n - start1) / (end1 - start1)) * (end2 - start2) + start2;
}

const kawaseVertex = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void)
{
  gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aTextureCoord;
}`;

const kawaseFragment = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;

uniform vec2 uOffset;
uniform vec4 filterClamp;

void main(void)
{
  vec4 color = vec4(0.0);

  color += texture2D(uSampler, clamp(vec2(vTextureCoord.x - uOffset.x, vTextureCoord.y + uOffset.y), filterClamp.xy, filterClamp.zw));
  color += texture2D(uSampler, clamp(vec2(vTextureCoord.x + uOffset.x, vTextureCoord.y + uOffset.y), filterClamp.xy, filterClamp.zw));
  color += texture2D(uSampler, clamp(vec2(vTextureCoord.x + uOffset.x, vTextureCoord.y - uOffset.y), filterClamp.xy, filterClamp.zw));
  color += texture2D(uSampler, clamp(vec2(vTextureCoord.x - uOffset.x, vTextureCoord.y - uOffset.y), filterClamp.xy, filterClamp.zw));

  gl_FragColor = color * 0.25;
}`;

class KawaseBlurFilter extends PIXI.Filter {
  constructor(blur = 4, quality = 3) {
    super(kawaseVertex, kawaseFragment);
    this.uniforms.uOffset = new Float32Array(2);
    this._pixelSize = new PIXI.Point(1, 1);
    this._blur = blur;
    this._quality = quality;
    this._kernels = [];
    this._generateKernels();
  }

  apply(filterManager, input, output, clearMode) {
    const pixelSizeX = this._pixelSize.x / input._frame.width;
    const pixelSizeY = this._pixelSize.y / input._frame.height;
    let kernel;

    if (this._quality === 1 || this._blur === 0) {
      kernel = this._kernels[0] + 0.5;
      this.uniforms.uOffset[0] = kernel * pixelSizeX;
      this.uniforms.uOffset[1] = kernel * pixelSizeY;
      filterManager.applyFilter(this, input, output, clearMode);
      return;
    }

    const renderTarget = filterManager.getFilterTexture();
    let source = input;
    let target = renderTarget;

    for (let i = 0; i < this._quality - 1; i++) {
      kernel = this._kernels[i] + 0.5;
      this.uniforms.uOffset[0] = kernel * pixelSizeX;
      this.uniforms.uOffset[1] = kernel * pixelSizeY;
      filterManager.applyFilter(this, source, target, 1);
      const temporary = source;
      source = target;
      target = temporary;
    }

    kernel = this._kernels[this._quality - 1] + 0.5;
    this.uniforms.uOffset[0] = kernel * pixelSizeX;
    this.uniforms.uOffset[1] = kernel * pixelSizeY;
    filterManager.applyFilter(this, source, output, clearMode);
    filterManager.returnFilterTexture(renderTarget);
  }

  _generateKernels() {
    this._kernels = [this._blur];

    if (this._blur > 0) {
      let kernel = this._blur;
      const step = this._blur / this._quality;

      for (let i = 1; i < this._quality; i++) {
        kernel -= step;
        this._kernels.push(kernel);
      }
    }

    this.padding = Math.ceil(this._kernels.reduce((sum, kernel) => sum + kernel + 0.5, 0));
  }
}

const noise2D = createNoise2D();

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
    this.baseColor = hslToNumber(this.hue, this.saturation, this.lightness);
    this.complimentaryColor1 = hslToNumber(
      this.complimentaryHue1,
      this.saturation,
      this.lightness
    );
    this.complimentaryColor2 = hslToNumber(
      this.complimentaryHue2,
      this.saturation,
      this.lightness
    );
    this.colorChoices = [
      this.baseColor,
      this.complimentaryColor1,
      this.complimentaryColor2
    ];
  }

  randomColor() {
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

// Orb class
class Orb {
  // Pixi takes hex colors as hexidecimal literals (0x rather than a string with '#')
  constructor(fill = 0x000000) {
    // bounds = the area an orb is "allowed" to move within
    this.bounds = this.setBounds();
    // initialise the orb's { x, y } values to a random point within it's bounds
    this.x = random(this.bounds["x"].min, this.bounds["x"].max);
    this.y = random(this.bounds["y"].min, this.bounds["y"].max);

    // how large the orb is vs it's original radius (this will modulate over time)
    this.scale = 1;

    // what color is the orb?
    this.fill = fill;

    // the original radius of the orb, set relative to window height
    this.radius = this.setRadius();

    // starting points in "time" for the noise/self similar random values
    this.xOff = random(0, 1000);
    this.yOff = random(0, 1000);
    // how quickly the noise/self similar random values step through time
    this.inc = 0.002;

    // PIXI.Graphics is used to draw 2d primitives (in this case a circle) to the canvas
    this.graphics = new PIXI.Graphics();
    this.graphics.alpha = 0.825;
    this.drawCircle();
  }

  setRadius() {
    return random(window.innerHeight / 6, window.innerHeight / 3);
  }

  setFill(fill) {
    this.fill = fill;
    this.drawCircle();
  }

  drawCircle() {
    this.graphics.clear();
    this.graphics.beginFill(this.fill);
    this.graphics.drawCircle(0, 0, this.radius);
    this.graphics.endFill();
  }

  resize() {
    this.bounds = this.setBounds();
    this.radius = this.setRadius();
    this.drawCircle();
  }

  setBounds() {
    // how far from the { x, y } origin can each orb move
    const maxDist =
      window.innerWidth < 1000 ? window.innerWidth / 3 : window.innerWidth / 5;
    // the { x, y } origin for each orb (the bottom right of the screen)
    const originX = window.innerWidth / 1.25;
    const originY =
      window.innerWidth < 1000
        ? window.innerHeight
        : window.innerHeight / 1.375;

    // allow each orb to move x distance away from it's x / y origin
    return {
      x: {
        min: originX - maxDist,
        max: originX + maxDist
      },
      y: {
        min: originY - maxDist,
        max: originY + maxDist
      }
    };
  }

  update() {
    // self similar "psuedo-random" or noise values at a given point in "time"
    const xNoise = noise2D(this.xOff, this.xOff);
    const yNoise = noise2D(this.yOff, this.yOff);
    const scaleNoise = noise2D(this.xOff, this.yOff);

    // map the xNoise/yNoise values (between -1 and 1) to a point within the orb's bounds
    this.x = map(xNoise, -1, 1, this.bounds["x"].min, this.bounds["x"].max);
    this.y = map(yNoise, -1, 1, this.bounds["y"].min, this.bounds["y"].max);
    // map scaleNoise (between -1 and 1) to a scale value somewhere between half of the orb's original size, and 100% of it's original size
    this.scale = map(scaleNoise, -1, 1, 0.5, 1);

    // step through "time"
    this.xOff += this.inc;
    this.yOff += this.inc;
  }

  render() {
    // update the PIXI.Graphics position and scale values
    this.graphics.x = this.x;
    this.graphics.y = this.y;
    this.graphics.scale.set(this.scale);
  }
}

// Create PixiJS app
const app = new PIXI.Application({
  // render to <canvas class="orb-canvas"></canvas>
  view: document.querySelector(".orb-canvas"),
  // auto adjust size to fit the current window
  resizeTo: window,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  // transparent background, we will be creating a gradient background later using CSS
  backgroundAlpha: 0
});

// Create colour palette
const colorPalette = new ColorPalette();

app.stage.filters = [new KawaseBlurFilter(30, 10)];

// Create orbs
const orbs = [];

for (let i = 0; i < 10; i++) {
  const orb = new Orb(colorPalette.randomColor());

  app.stage.addChild(orb.graphics);

  orbs.push(orb);
}

function renderOrbs() {
  orbs.forEach((orb) => {
    orb.update();
    orb.render();
  });
}

function syncAnimationState() {
  if (document.hidden || reducedMotion.matches) {
    app.ticker.stop();
    renderOrbs();
    return;
  }

  app.ticker.start();
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

app.ticker.add(renderOrbs);

document
  .querySelector(".overlay__btn--colors")
  .addEventListener("click", () => {
    colorPalette.setColors();
    colorPalette.setCustomProperties();

    orbs.forEach((orb) => {
      orb.setFill(colorPalette.randomColor());
    });
  });

document.addEventListener("visibilitychange", syncAnimationState);
window.addEventListener(
  "resize",
  debounce(() => {
    orbs.forEach((orb) => orb.resize());
  }, 250)
);

if (typeof reducedMotion.addEventListener === "function") {
  reducedMotion.addEventListener("change", syncAnimationState);
} else {
  reducedMotion.addListener(syncAnimationState);
}

syncAnimationState();
