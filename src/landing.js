const APP_VERSION = "20260722-local-autosave-sky";
const LEPTON_ICON_PATH = `./src/assets/lepton-favicon.png?v=${APP_VERSION}`;

function ensureLeptonFavicon() {
  const iconHref =
    typeof URL !== "undefined" && typeof document !== "undefined" ? new URL(LEPTON_ICON_PATH, document.baseURI).href : LEPTON_ICON_PATH;
  document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((link) => link.remove());
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = iconHref;
    if (rel !== "apple-touch-icon") link.type = "image/png";
    if (rel === "icon") link.setAttribute("sizes", "any");
    document.head.append(link);
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
draw(eq,colour=rgb,boundary=rest)`,
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
draw(combined,colour=rgb,boundary=rest)`,
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
time unbounded t = 0 speed 1
variable eq = sin(sqrt(x^2+y^2)*4-t*2)+0.7*cos(x*2-y*1.5+t)+0.35*sin(y*3+t*1.2)
variable r = 105+65*sin(eq+t*0.2)
variable g = 145+85*cos(x/2+t*0.35)
variable b = 215+35*sin(y/2+t*0.45)
variable rest = 1
colour rgb = r~g~b
boundary rest = rest~False
draw(eq,colour=rgb,boundary=rest)`,
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
draw(eq,colour=rgb,boundary=rest)`,
  sky: `set x_min = -10
set x_max = 10
set y_min = -10
set y_max = 10
set max_recursion = 100
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
set show_coordinate_grid = False
set show_grid = True
set show_x_axis = True
set show_y_axis = True
set show_x_numbers = True
set show_y_numbers = True
set unbounded_decimal_places = 3
set random_seed = 1684643011
time unbounded t = 10269.973 speed 1
folder easy stuff = {
  folder Sky = {
    expression skyfield = y+0.08*sin(0.09*x+0.03*t)+0.04*sin(0.037*x*y)
    colour skycolor = 100+frac{125*1}{e^(frac{x^2}{16})}+18*clamp(0-x,0,1)~122+frac{44*1}{e^(frac{x^2}{20})}-2*abs(x)+clamp(0-x,0,4)~186-frac{64}{e^(frac{x^2}{196})}
    draw(skyfield,colour=skycolor)
  }
  folder sun = {
    expression sunvalue = frac{10}{x^2+(y-2)^2}
    draw(sunvalue,colour=background,transparency=sun)
    colour background = 255*x~175*x~100*x
    transparency sun = 1-frac{x}{10}
  }
}
folder Cloud volume = {
  // Smooth value noise is assembled from a coordinate hash and cubic interpolation.
  function cloudHash(px,py) = sin(127.1*px+311.7*py)*43758.5453-floor(sin(127.1*px+311.7*py)*43758.5453)
  function cloudFade(v) = v^2*(3-2*v)
  function cloudNoise(px,py) = (cloudHash(floor(px),floor(py))*(1-cloudFade(px-floor(px)))+cloudHash(floor(px)+1,floor(py))*cloudFade(px-floor(px)))*(1-cloudFade(py-floor(py)))+(cloudHash(floor(px),floor(py)+1)*(1-cloudFade(px-floor(px)))+cloudHash(floor(px)+1,floor(py)+1)*cloudFade(px-floor(px)))*cloudFade(py-floor(py))
  function cloudFbm(px,py,q) = 0.53*cloudNoise(0.36*px+0.36*sin(pi*frac{q}{5}),0.36*py-0.28*cos(pi*frac{q}{5}))+0.25*cloudNoise(0.73*px-0.29*cos(pi*frac{q}{5}),0.71*py+0.31*sin(pi*frac{q}{5}))+0.14*cloudNoise(1.47*px+0.24*sin(pi*frac{q}{5}),1.51*py-0.22*cos(pi*frac{q}{5}))+0.08*cloudNoise(2.93*px-0.18*cos(pi*frac{q}{5}),3.07*py+0.17*sin(pi*frac{q}{5}))
  function cloudFine(px,py,q) = 0.57*cloudNoise(1.19*px+0.41*cos(pi*frac{q}{5}),1.13*py-0.37*sin(pi*frac{q}{5}))+0.28*cloudNoise(2.41*px-0.33*sin(pi*frac{q}{5}),2.53*py+0.29*cos(pi*frac{q}{5}))+0.15*cloudNoise(4.87*px+0.23*cos(pi*frac{q}{5}),4.69*py-0.21*sin(pi*frac{q}{5}))
  function cloudDensity(px,py,q) = 1.58*cloudFbm(px,py,q)+0.28*(1-abs(2*cloudFine(px+1.73,py-0.91,q)-1))-0.17*(py+1.5)-1.02
  function farDensity(px,py,q) = 1.34*cloudFbm(0.72*px+4.1,0.72*py-2.7,q+1.9)+0.15*cloudFine(0.61*px,0.61*py,q)-frac{abs(py-0.35)}{2.35}-0.61
}
folder Distant clouds = {
  expression farCloud = farDensity(x+0.18*cos(pi*frac{t}{5}),y,t)
  expression farGlow = clamp(farCloud,0,1.2)*frac{1}{e^(frac{x^2+(y-2)^2}{42})}
  colour farCloudColour = 116+92*clamp(x,0,1)+4*y~120+78*clamp(x,0,1)+3*y~151+66*clamp(x,0,1)+3*y
  transparency farCloudFade = clamp(1-1.42*clamp(x,0,0.72),0.18,1)
  colour farGlowColour = 255~184+48*clamp(x,0,1)~126+64*clamp(x,0,1)
  transparency farGlowFade = clamp(1-2.1*clamp(x,0,0.48),0.22,1)
  draw(farCloud,colour=farCloudColour,transparency=farCloudFade)
  draw(farGlow,colour=farGlowColour,transparency=farGlowFade)
}
folder Foreground billows = {
  expression cloudMain = cloudDensity(x+0.24*sin(pi*frac{t}{5}),y,t)
  expression cloudCavity = clamp(cloudMain,0,1)*clamp(0.88-cloudFine(x+0.27,y-0.19,t+0.61),0,1)
  expression cloudScatter = clamp(cloudMain,0,0.72)*frac{1}{e^(frac{x^2+(y-2)^2}{31})}*(0.72+0.38*cloudFine(x-0.31,y+0.23,t+0.29))
  expression cloudRim = clamp(cloudMain,0,0.16)*frac{1}{e^(frac{x^2+(y-2)^2}{25})}*(1.1+0.7*cloudFine(x+0.19,y+0.17,t+0.83))
  colour cloudBaseColour = 57+109*clamp(x,0,1.3)+5*y~64+99*clamp(x,0,1.3)+4*y~91+104*clamp(x,0,1.3)+4*y
  transparency cloudBaseFade = clamp(1-1.55*clamp(x,0,0.64),0.015,1)
  colour cloudCavityColour = 42+62*clamp(x,0,1)~48+57*clamp(x,0,1)~75+64*clamp(x,0,1)
  transparency cloudCavityFade = clamp(1-0.88*clamp(x,0,0.9),0.26,1)
  colour cloudScatterColour = 255~174+66*clamp(x,0,1)~112+79*clamp(x,0,1)
  transparency cloudScatterFade = clamp(1-2.7*clamp(x,0,0.36),0.08,1)
  colour cloudRimColour = 255~219~174
  transparency cloudRimFade = clamp(1-5.8*clamp(x,0,0.17),0.04,1)
  draw(cloudMain,colour=cloudBaseColour,transparency=cloudBaseFade)
  draw(cloudCavity,colour=cloudCavityColour,transparency=cloudCavityFade)
  draw(cloudScatter,colour=cloudScatterColour,transparency=cloudScatterFade)
  draw(cloudRim,colour=cloudRimColour,transparency=cloudRimFade)
}`
};

for (const link of document.querySelectorAll("[data-sample]")) {
  const scene = sampleScenes[link.dataset.sample];
  if (!scene) continue;
  link.href = `./app.html?scene=${encodeURIComponent(scene)}&v=${APP_VERSION}`;
}

for (const link of document.querySelectorAll('[data-launch-blank]')) {
  link.href = `./app.html?v=${APP_VERSION}`;
}
