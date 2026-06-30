const APP_VERSION = "20260630-recursion-links";
const LEPTON_ICON_PATH = `./src/assets/lepton-favicon.png?v=${APP_VERSION}`;

function ensureLeptonFavicon() {
  const iconHref =
    typeof URL !== "undefined" && typeof document !== "undefined" ? new URL(LEPTON_ICON_PATH, document.baseURI).href : LEPTON_ICON_PATH;
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.append(link);
    }
    link.href = iconHref;
    if (rel !== "apple-touch-icon") link.type = "image/png";
  }
}

ensureLeptonFavicon();

const sampleScenes = {
  fire: `set x_min = -15
set x_max = 15
set y_min = -15
set y_max = 15
set max_recursion = 100
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
variable eq = arctan(2sin(-2x-y/8+cos(3y-x-sin(cos(sin(sin(x*y)+x))+x-y+arccot(x)*arctan(y))))+frac{(x^{2}+frac{y^{2}}{14})}{3}-(frac{100}{x^{2}+y^{2}})+e^{-4-y})
variable r = 255((-x-(cos(3.7(-x+0.8))/3))/2.8+1.28)
variable g = 255(sin(1.5(-x+pi/2))/2.8+0.5)
variable b = 255(e^(-(3(-x+0.99))^2)/3+x/9+0.1)
variable rest = 1
colour rgb = r~g~b
boundary rest = rest~False
draw(eq,rgb,rest,False)`,
  mandelbrot: `set x_min = -2
set x_max = 1
set y_min = -2
set y_max = 2
set max_recursion = 12
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
variable real = real^2-imaginary^2+x
variable imaginary = 2*real*imaginary+y
variable one = 1
variable combined = real^2+imaginary^2
variable rest = combined-4
colour rgb = one~one~one
boundary rest = rest~True
draw(combined,rgb,rest,False)`,
  water: `set x_min = -12
set x_max = 12
set y_min = -8
set y_max = 8
set max_recursion = 40
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
variable eq = sin(sqrt(x^2+y^2)*4)+cos(x*2-y*1.5)
variable r = 120+80*sin(eq)
variable g = 150+90*cos(x/2)
variable b = 210+40*sin(y/2)
variable rest = 1
colour rgb = r~g~b
boundary rest = rest~False
draw(eq,rgb,rest,False)`,
  stars: `set x_min = -8
set x_max = 8
set y_min = -8
set y_max = 8
set max_recursion = 40
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
variable rad = sqrt(x^2+y^2)
variable fade = e^(0-rad^2/18)
variable theta = arctan(y/(x+0.02))
variable swirl = 0.5+0.5*sin(3*theta+2.8*rad)
variable core = e^(0-rad^2/3.5)
variable spark = e^(0-(abs(sin(12.7*x+2.1*sin(y)))+abs(cos(13.3*y+1.9*sin(x))))/0.045)*fade
variable eq = fade*swirl+core+0.35*spark
variable r = 5+95*fade*swirl+235*core+175*spark
variable g = 8+65*fade*swirl+145*core+165*spark
variable b = 28+175*fade*swirl+225*core+225*spark
variable rest = 1
colour rgb = r~g~b
boundary rest = rest~False
draw(eq,rgb,rest,False)`
};

for (const link of document.querySelectorAll("[data-sample]")) {
  const scene = sampleScenes[link.dataset.sample];
  if (!scene) continue;
  link.href = `./app.html?scene=${encodeURIComponent(scene)}&v=${APP_VERSION}`;
}

for (const link of document.querySelectorAll('[data-launch-blank]')) {
  link.href = `./app.html?v=${APP_VERSION}`;
}
