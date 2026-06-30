const APP_VERSION = "20260630-load-picker";
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
time unbounded t = 0
variable eq = sin(sqrt(x^2+y^2)*4-t*2)+0.7*cos(x*2-y*1.5+t)+0.35*sin(y*3+t*1.2)
variable r = 105+65*sin(eq+t*0.2)
variable g = 145+85*cos(x/2+t*0.35)
variable b = 215+35*sin(y/2+t*0.45)
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
variable galaxy = 1/(1+0.08*x^2+0.42*y^2)
variable theta = arctan(y/(x+0.08))
variable arm = 0.5+0.5*sin(3*theta+2.4*rad)
variable core = 1/(1+0.45*rad^2)
variable dust = 1/(1+24*(abs(sin(12.7*x+2.1*sin(y)))+abs(cos(13.3*y+1.9*sin(x)))))
variable eq = galaxy*(0.35+0.65*arm)+core+0.45*dust*galaxy
variable r = 6+95*galaxy*arm+235*core+155*dust*galaxy
variable g = 10+70*galaxy*arm+145*core+145*dust*galaxy
variable b = 32+180*galaxy*arm+225*core+220*dust*galaxy
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
