const LEPTON_ICON_PATH = "./src/assets/lepton-logo-transparent.png?v=20260626-grid-settings1";

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
function eq = arctan(2sin(-2x-y/8+cos(3y-x-sin(cos(sin(sin(x*y)+x))+x-y+arccot(x)*arctan(y))))+frac{(x^{2}+frac{y^{2}}{14})}{3}-(frac{100}{x^{2}+y^{2}})+e^{-4-y})
function r = 255((-x-(cos(3.7(-x+0.8))/3))/2.8+1.28)
function g = 255(sin(1.5(-x+pi/2))/2.8+0.5)
function b = 255(e^(-(3(-x+0.99))^2)/3+x/9+0.1)
function rest = 1
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
function real = real^2-imaginary^2+x
function imaginary = 2*real*imaginary+y
function one = 1
function combined = real^2+imaginary^2
function rest = combined-4
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
function eq = sin(sqrt(x^2+y^2)*4)+cos(x*2-y*1.5)
function r = 120+80*sin(eq)
function g = 150+90*cos(x/2)
function b = 210+40*sin(y/2)
function rest = 1
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
function rad = sqrt(x^2+y^2)
function fade = e^(0-rad^2/18)
function theta = arctan(y/(x+0.02))
function swirl = 0.5+0.5*sin(3*theta+2.8*rad)
function core = e^(0-rad^2/3.5)
function spark = e^(0-(abs(sin(12.7*x+2.1*sin(y)))+abs(cos(13.3*y+1.9*sin(x))))/0.045)*fade
function eq = fade*swirl+core+0.35*spark
function r = 5+95*fade*swirl+235*core+175*spark
function g = 8+65*fade*swirl+145*core+165*spark
function b = 28+175*fade*swirl+225*core+225*spark
function rest = 1
colour rgb = r~g~b
boundary rest = rest~False
draw(eq,rgb,rest,False)`
};

for (const link of document.querySelectorAll("[data-sample]")) {
  const scene = sampleScenes[link.dataset.sample];
  if (!scene) continue;
  link.href = `./app.html?scene=${encodeURIComponent(scene)}`;
}
