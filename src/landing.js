const APP_VERSION = "20260728-marble-contrast2";
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
boundary rest = rest
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
boundary rest = 0-(rest)
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
boundary rest = rest
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
boundary rest = rest
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
}`,
  tree: `set x_min = -10
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
set show_grid = False
set show_x_axis = False
set show_y_axis = False
set show_x_numbers = False
set show_y_numbers = False
set unbounded_decimal_places = 3
set random_seed = 184729
folder Environment = {
  expression sky = y
  colour skyColour = 126+2.1*x~169+2.2*x~207+2*x
  draw(sky,colour=skyColour)
  expression atmosphericGlow = frac{1}{e^(frac{(x+5.7)^2+(y-6.2)^2}{15})}
  colour glowColour = 255~225~165
  transparency glowFade = 1-0.34*clamp(x,0,1)
  draw(atmosphericGlow,colour=glowColour,transparency=glowFade)
  expression ground = -6.75-y+0.09*sin(0.73*x)+0.035*sin(2.3*x)
  colour groundColour = 46+15*clamp(x,0,1)~64+21*clamp(x,0,1)~35+9*clamp(x,0,1)
  transparency groundFade = clamp(1-18*x,0,1)
  draw(ground,colour=groundColour,transparency=groundFade)
  expression groundDetail = ground+0.07*sin(5.7*x+1.3*y)+0.035*sin(13.1*x-2.1*y)-0.08
  colour groundDetailColour = 77~82~43
  transparency groundDetailFade = clamp(1-19*x,0.72,1)
  draw(groundDetail,colour=groundDetailColour,transparency=groundDetailFade)
  expression groundShadow = min(ground+0.08,ellipse2(x,y,1.1,-6.72,3.8,0.42))
  colour groundShadowColour = 22~29~18
  transparency groundShadowFade = clamp(1-9*x,0.45,1)
  draw(groundShadow,colour=groundShadowColour,transparency=groundShadowFade)
}
folder Geometry and noise = {
  function hash2(px,py) = sin(127.1*px+311.7*py)*43758.5453-floor(sin(127.1*px+311.7*py)*43758.5453)
  function fade2(v) = v*v*(3-2*v)
  function noise2(px,py) = (hash2(floor(px),floor(py))*(1-fade2(px-floor(px)))+hash2(floor(px)+1,floor(py))*fade2(px-floor(px)))*(1-fade2(py-floor(py)))+(hash2(floor(px),floor(py)+1)*(1-fade2(px-floor(px)))+hash2(floor(px)+1,floor(py)+1)*fade2(px-floor(px)))*fade2(py-floor(py))
  function fbm2(px,py) = 0.54*noise2(px,py)+0.28*noise2(2.03*px+4.7,2.07*py-2.9)+0.12*noise2(4.11*px-7.2,3.97*py+5.1)+0.06*noise2(8.17*px+2.4,8.03*py-8.6)
  function ellipse2(px,py,cx,cy,rx,ry) = 1-frac{(px-cx)^2}{rx^2}-frac{(py-cy)^2}{ry^2}
  function leafCell(px,py,s) = 1-frac{(px*s-floor(px*s)-(0.15+0.7*hash2(floor(px*s),floor(py*s))))^2}{0.095}-frac{(py*s-floor(py*s)-(0.15+0.7*hash2(floor(px*s)+19.1,floor(py*s)-7.3)))^2}{0.038}
  function branch2(px,py,ax,ay,bx,by,ra,rb) = ra+(rb-ra)*clamp(frac{(px-ax)*(bx-ax)+(py-ay)*(by-ay)}{(bx-ax)^2+(by-ay)^2},0,1)-sqrt((px-(ax+(bx-ax)*clamp(frac{(px-ax)*(bx-ax)+(py-ay)*(by-ay)}{(bx-ax)^2+(by-ay)^2},0,1)))^2+(py-(ay+(by-ay)*clamp(frac{(px-ax)*(bx-ax)+(py-ay)*(by-ay)}{(bx-ax)^2+(by-ay)^2},0,1)))^2)
}
folder Trunk structure = {
  expression trunkAxis = 0.12*sin(0.48*y)-0.028*y-0.04
  expression trunkWidth = 0.25+0.063*(2.35-y)+0.1*clamp(-6-y,0,1)
  expression trunk = min(min(trunkWidth+0.055*(noise2(3.1*x+1.7,1.45*y-2.8)-0.5)-abs(x-trunkAxis),y+6.85),2.65-y)
  expression leftLimbs = max(max(max(branch2(x,y,-0.02,1.4,-2.35,4.5,0.28,0.13),branch2(x,y,-1.65,3.65,-4.5,5.5,0.17,0.055)),max(branch2(x,y,-0.08,0.55,-3.15,2.85,0.3,0.105),branch2(x,y,-2.3,2.2,-5.1,3.8,0.13,0.045))),max(branch2(x,y,-1.7,4.05,-2.8,6.75,0.115,0.035),branch2(x,y,-3.45,4.85,-5.2,6.35,0.08,0.025)))
  expression rightLimbs = max(max(max(branch2(x,y,0.03,1.75,2.65,4.8,0.29,0.13),branch2(x,y,1.75,3.75,4.7,5.75,0.17,0.05)),max(branch2(x,y,0.02,0.2,3.45,2.8,0.31,0.11),branch2(x,y,2.45,2.05,5.35,3.75,0.14,0.04))),max(branch2(x,y,1.65,4.05,2.85,6.9,0.115,0.035),branch2(x,y,3.55,4.95,5.25,6.25,0.075,0.02)))
  expression crownForks = max(max(branch2(x,y,-0.03,2.1,-0.95,7.2,0.22,0.045),branch2(x,y,0.02,2.15,1.15,7.4,0.21,0.04)),max(branch2(x,y,-0.65,5.3,-3.35,7.55,0.09,0.018),branch2(x,y,0.8,5.45,3.55,7.5,0.09,0.018)))
  expression wood = max(max(trunk,leftLimbs),max(rightLimbs,crownForks))
  boundary woodInside = wood
  colour woodBase = 63+23*clamp(x,0,0.8)+1.3*y~39+14*clamp(x,0,0.8)+0.8*y~23+8*clamp(x,0,0.8)+0.45*y
  transparency woodOpacity = clamp(1-24*x,0,1)
  draw(wood,colour=woodBase,transparency=woodOpacity)
  expression woodShade = min(wood,0.18-(x-trunkAxis))
  colour woodShadeColour = 30+12*clamp(x,0,0.5)~18+7*clamp(x,0,0.5)~12+4*clamp(x,0,0.5)
  transparency woodShadeFade = clamp(1-8*x,0.5,1)
  draw(woodShade,colour=woodShadeColour,boundary=woodInside,transparency=woodShadeFade)
  expression woodLight = min(wood,0.16+(x-trunkAxis))
  colour woodLightColour = 116+24*clamp(x,0,0.45)~73+17*clamp(x,0,0.45)~40+10*clamp(x,0,0.45)
  transparency woodLightFade = clamp(1-10*x,0.69,1)
  draw(woodLight,colour=woodLightColour,boundary=woodInside,transparency=woodLightFade)
  expression barkCracks = min(wood,0.024+0.025*sin(34*x+1.9*y+2.6*sin(0.58*y))+0.011*sin(79*x-4.1*y))
  colour barkCrackColour = 23~14~9
  transparency barkCrackFade = clamp(1-38*x,0.35,1)
  draw(barkCracks,colour=barkCrackColour,boundary=woodInside,transparency=barkCrackFade)
  expression barkScales = min(wood,noise2(14*x+2.1,2.4*y-3.7)-0.57)
  colour barkScaleColour = 87~53~29
  transparency barkScaleFade = clamp(1-32*x,0.7,1)
  draw(barkScales,colour=barkScaleColour,boundary=woodInside,transparency=barkScaleFade)
  expression knots = min(wood,max(max(ellipse2(x,y,-0.15,-3.15,0.13,0.25),ellipse2(x,y,0.1,-0.75,0.1,0.18)),ellipse2(x,y,-0.02,1.25,0.08,0.15)))
  colour knotColour = 24~14~9
  transparency knotFade = clamp(1-42*x,0.12,1)
  draw(knots,colour=knotColour,boundary=woodInside,transparency=knotFade)
}
folder Discontinuous foliage = {
  expression crownEnvelope = max(max(max(ellipse2(x,y,-4.35,3.35,2.05,1.8),ellipse2(x,y,-3.25,5.35,2.35,2.1)),max(ellipse2(x,y,-1.25,6.85,2.5,2.0),ellipse2(x,y,1.15,7.05,2.65,1.95))),max(max(ellipse2(x,y,3.35,5.6,2.45,2.05),ellipse2(x,y,4.55,3.5,1.95,1.75)),max(ellipse2(x,y,1.8,3.85,3.05,2.25),ellipse2(x,y,-1.55,3.8,3.0,2.25))))
  expression crownMask = crownEnvelope+0.3*(fbm2(0.69*x+0.08*y,0.71*y-0.06*x)-0.49)+0.17*(fbm2(1.43*x-4.2,1.37*y+2.8)-0.5)+0.055*(noise2(4.7*x+1.8,4.5*y-3.2)-0.5)
  boundary insideCrown = crownMask
  expression deepLeaves = min(crownMask,fbm2(1.34*x+1.7,1.29*y-4.1)-0.365+0.018*sin(4.3*x-2.7*y))
  colour deepLeafColour = 12+50*clamp(x,0,0.55)+1.8*y~33+84*clamp(x,0,0.55)+3.1*y~16+42*clamp(x,0,0.55)+1.2*y
  transparency deepLeafFade = clamp(1-31*x,0.05,1)
  draw(deepLeaves,colour=deepLeafColour,boundary=insideCrown,transparency=deepLeafFade)
  expression undersideLeaves = min(deepLeaves,4.7-y)
  colour undersideColour = 12+25*clamp(x,0,0.45)~27+47*clamp(x,0,0.45)~14+24*clamp(x,0,0.45)
  transparency undersideFade = clamp(1-24*x,0.34,1)
  draw(undersideLeaves,colour=undersideColour,boundary=insideCrown,transparency=undersideFade)
  expression middleLeaves = min(crownMask+0.025,fbm2(2.27*x-7.1,2.19*y+3.8)-0.465+0.026*sin(7.7*x+5.1*y))
  colour middleLeafColour = 33+78*clamp(x,0,0.43)+1.5*y~77+103*clamp(x,0,0.43)+2.4*y~31+65*clamp(x,0,0.43)+1*y
  transparency middleLeafFade = clamp(1-38*x,0.27,1)
  draw(middleLeaves,colour=middleLeafColour,boundary=insideCrown,transparency=middleLeafFade)
  expression smallLeaves = min(crownMask+0.045,fbm2(4.55*x+3.2,4.31*y-8.5)-0.555+0.018*sin(16.1*x-13.7*y))
  colour smallLeafColour = 72+97*clamp(x,0,0.35)+0.5*y~127+108*clamp(x,0,0.35)+0.7*y~52+75*clamp(x,0,0.35)
  transparency smallLeafFade = clamp(1-52*x,0.43,1)
  draw(smallLeaves,colour=smallLeafColour,boundary=insideCrown,transparency=smallLeafFade)
  expression sunLeaves = min(crownMask+0.06,fbm2(3.15*x-6.9,3.03*y+7.7)-0.585-0.025*x+0.017*y)
  colour sunLeafColour = 112+91*clamp(x,0,0.3)~151+76*clamp(x,0,0.3)~59+55*clamp(x,0,0.3)
  transparency sunLeafFade = clamp(1-58*x,0.56,1)
  draw(sunLeaves,colour=sunLeafColour,boundary=insideCrown,transparency=sunLeafFade)
  expression edgeLeaves = min(crownMask,0.075-crownMask+0.035*(noise2(7.7*x,7.3*y)-0.46))
  colour edgeLeafColour = 112+83*clamp(x,0,0.25)~148+73*clamp(x,0,0.25)~60+51*clamp(x,0,0.25)
  transparency edgeLeafFade = clamp(1-56*x,0.5,1)
  draw(edgeLeaves,colour=edgeLeafColour,boundary=insideCrown,transparency=edgeLeafFade)
  expression peripheralLeaves = min(crownMask+0.13,fbm2(5.65*x-3.3,5.37*y+9.4)-0.61+0.02*sin(19.3*x-14.1*y))
  colour peripheralLeafColour = 76+81*clamp(x,0,0.28)~126+86*clamp(x,0,0.28)~49+58*clamp(x,0,0.28)
  transparency peripheralLeafFade = clamp(1-61*x,0.5,1)
  draw(peripheralLeaves,colour=peripheralLeafColour,transparency=peripheralLeafFade)
  expression individualLeaves = min(crownMask+0.17,max(leafCell(0.86*x+0.5*y+0.07*sin(1.7*y),-0.5*x+0.86*y,3.1),leafCell(0.94*x-0.34*y,0.34*x+0.94*y+0.06*sin(1.3*x),3.55)-0.08))
  colour individualLeafColour = 55+95*clamp(x,0,0.32)+0.6*y~107+103*clamp(x,0,0.32)+0.9*y~40+66*clamp(x,0,0.32)
  transparency individualLeafFade = clamp(1-48*x,0.24,1)
  draw(individualLeaves,colour=individualLeafColour,transparency=individualLeafFade)
  expression leafGlints = min(crownMask,fbm2(7.8*x+2.4,7.45*y-5.1)-0.675-0.022*x+0.014*y)
  colour glintColour = 165~191~94
  transparency glintFade = clamp(1-72*x,0.74,1)
  draw(leafGlints,colour=glintColour,boundary=insideCrown,transparency=glintFade)
}`,
  lava: `set x_min = -10
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
set show_grid = False
set show_x_axis = False
set show_y_axis = False
set show_x_numbers = False
set show_y_numbers = False
set unbounded_decimal_places = 3
set random_seed = 491702
folder Animation = {
  time bounded_looped t = 0 range 0~24 speed 0.65
  expression phase = pi*t/12
}
folder Shape helpers = {
  function ellipseLamp(px,py,cx,cy,rx,ry) = 1-frac{(px-cx)^2}{rx^2}-frac{(py-cy)^2}{ry^2}
  function taperLamp(px,py,y0,y1,w0,w1) = min(min(py-y0,y1-py),w0+(w1-w0)*frac{py-y0}{y1-y0}-abs(px))
  function lavaBlob(px,py,cx,cy,rx,ry) = frac{1}{e^(frac{(px-cx)^2}{rx^2}+frac{(py-cy)^2}{ry^2})}
}
folder Dark room = {
  expression room = y
  colour roomColour = 9+2*clamp(x,0,1)~8+1.5*clamp(x,0,1)~14+3*clamp(x,0,1)
  draw(room,colour=roomColour)
  expression wallGlow = lavaBlob(x,y,0,-0.2,5.2,7.2)
  colour wallGlowColour = 92+76*clamp(x,0,1)~20+34*clamp(x,0,1)~28+24*clamp(x,0,1)
  transparency wallGlowFade = clamp(0.99-0.22*clamp(x,0,1),0.77,1)
  draw(wallGlow,colour=wallGlowColour,transparency=wallGlowFade)
  expression table = -7.2-y
  colour tableColour = 17+7*clamp(x,0,1)~13+5*clamp(x,0,1)~17+6*clamp(x,0,1)
  transparency tableFade = clamp(1-22*x,0,1)
  draw(table,colour=tableColour,transparency=tableFade)
  expression lampShadow = min(table+0.1,ellipseLamp(x,y,0.4,-7.16,4.3,0.55))
  colour lampShadowColour = 2~2~4
  transparency lampShadowFade = clamp(1-10*x,0.36,1)
  draw(lampShadow,colour=lampShadowColour,transparency=lampShadowFade)
  expression tableGlow = min(table+0.08,ellipseLamp(x,y,0,-7.12,3.1,0.34))
  colour tableGlowColour = 100~24~22
  transparency tableGlowFade = clamp(1-7*x,0.76,1)
  draw(tableGlow,colour=tableGlowColour,transparency=tableGlowFade)
}
folder Glass chamber = {
  expression glassWidth = 1.76-0.052*(y+4.6)
  expression vessel = min(min(y+4.65,6.25-y),glassWidth-abs(x))
  boundary vesselInside = vessel
  expression liquidBackdrop = vessel
  colour liquidBackdropColour = 38+26*clamp(x,0,1)~7+10*clamp(x,0,1)~15+18*clamp(x,0,1)
  transparency liquidBackdropFade = clamp(0.9-0.28*clamp(x,0,1),0.58,0.92)
  draw(liquidBackdrop,colour=liquidBackdropColour,transparency=liquidBackdropFade)
}
folder Lava motion = {
  expression lavaAX = 0.36*sin(phase-0.4)+0.13*sin(2*phase)
  expression lavaAY = -2.65+6.65*(0.5+0.5*sin(phase-1.05))
  expression lavaBX = -0.48*sin(phase+0.85)+0.1*cos(2*phase)
  expression lavaBY = -2.45+6.15*(0.5+0.5*sin(phase+1.72))
  expression lavaCX = 0.62*sin(phase+2.15)
  expression lavaCY = -2.85+5.8*(0.5+0.5*sin(phase+3.78))
  expression lavaDX = -0.3+0.37*sin(2*phase+0.3)
  expression lavaDY = -2.9+6.4*(0.5+0.5*sin(phase+5.1))
  expression bottomHeat = lavaBlob(x,y,0,-3.95,1.34,0.72)
  expression topCooling = 0.52*lavaBlob(x,y,0.08,5.35,1.02,0.58)
  expression movingA = lavaBlob(x+0.055*sin(1.4*y+phase),y,lavaAX,lavaAY,0.64+0.12*sin(phase)^2,1.06+0.22*cos(phase)^2)
  expression movingB = lavaBlob(x-0.045*sin(1.1*y-phase),y,lavaBX,lavaBY,0.54+0.1*cos(phase)^2,0.92+0.25*sin(phase)^2)
  expression movingC = lavaBlob(x+0.04*sin(1.8*y+phase),y,lavaCX,lavaCY,0.43+0.08*sin(2*phase)^2,0.72+0.18*cos(phase)^2)
  expression movingD = lavaBlob(x-0.035*sin(1.6*y-phase),y,lavaDX,lavaDY,0.36+0.07*cos(phase)^2,0.65+0.15*sin(phase)^2)
  expression lavaField = bottomHeat+topCooling+0.92*movingA+0.82*movingB+0.66*movingC+0.58*movingD-0.61
  colour lavaBodyColour = 180+104*clamp(x,0,0.62)~19+97*clamp(x,0,0.62)~9+31*clamp(x,0,0.62)
  transparency lavaBodyFade = clamp(1-26*x,0.015,1)
  draw(lavaField,colour=lavaBodyColour,boundary=vesselInside,transparency=lavaBodyFade)
  expression lavaCore = lavaField-0.28
  colour lavaCoreColour = 255~87+96*clamp(x,0,0.4)~22+28*clamp(x,0,0.4)
  transparency lavaCoreFade = clamp(1-34*x,0.28,1)
  draw(lavaCore,colour=lavaCoreColour,boundary=vesselInside,transparency=lavaCoreFade)
  expression lavaSkin = min(lavaField,0.12-lavaField)
  colour lavaSkinColour = 255~140~52
  transparency lavaSkinFade = clamp(1-46*x,0.46,1)
  draw(lavaSkin,colour=lavaSkinColour,boundary=vesselInside,transparency=lavaSkinFade)
  expression lavaHotSpot = min(lavaCore,lavaBlob(x,y,lavaAX-0.18,lavaAY+0.16,0.3,0.62)-0.44)
  colour lavaHotSpotColour = 255~207~104
  transparency lavaHotSpotFade = clamp(1-38*x,0.58,1)
  draw(lavaHotSpot,colour=lavaHotSpotColour,boundary=vesselInside,transparency=lavaHotSpotFade)
}
folder Glass reflections = {
  expression glassRim = min(vessel,0.085-vessel)
  colour glassRimColour = 185+60*clamp(x,0,0.22)~82+65*clamp(x,0,0.22)~101+76*clamp(x,0,0.22)
  transparency glassRimFade = clamp(1-44*x,0.52,1)
  draw(glassRim,colour=glassRimColour,transparency=glassRimFade)
  expression leftReflection = min(vessel,0.095-abs(x+0.78-0.022*y))
  colour leftReflectionColour = 255~174~177
  transparency leftReflectionFade = clamp(1-20*x,0.83,1)
  draw(leftReflection,colour=leftReflectionColour,boundary=vesselInside,transparency=leftReflectionFade)
  expression softReflection = min(vessel,0.28-abs(x+0.58-0.018*y))
  colour softReflectionColour = 189~76~91
  transparency softReflectionFade = clamp(1-6*x,0.91,1)
  draw(softReflection,colour=softReflectionColour,boundary=vesselInside,transparency=softReflectionFade)
}
folder Metal base and cap = {
  expression base = max(taperLamp(x,y,-7.15,-4.35,2.55,1.7),ellipseLamp(x,y,0,-6.9,2.52,0.58))
  boundary baseInside = base
  colour baseColour = 36+46*clamp(x,0,0.75)~25+26*clamp(x,0,0.75)~30+28*clamp(x,0,0.75)
  transparency baseFade = clamp(1-24*x,0,1)
  draw(base,colour=baseColour,transparency=baseFade)
  expression baseShade = min(base,0.22-x)
  colour baseShadeColour = 10~8~13
  transparency baseShadeFade = clamp(1-9*x,0.42,1)
  draw(baseShade,colour=baseShadeColour,boundary=baseInside,transparency=baseShadeFade)
  expression baseHighlight = min(base,0.18-abs(x+0.72))
  colour baseHighlightColour = 116~62~66
  transparency baseHighlightFade = clamp(1-12*x,0.71,1)
  draw(baseHighlight,colour=baseHighlightColour,boundary=baseInside,transparency=baseHighlightFade)
  expression baseLip = min(base,0.11-abs(y+4.5))
  colour baseLipColour = 92~51~57
  transparency baseLipFade = clamp(1-28*x,0.38,1)
  draw(baseLip,colour=baseLipColour,boundary=baseInside,transparency=baseLipFade)
  expression cap = max(taperLamp(x,y,6.05,8.25,1.32,0.28),ellipseLamp(x,y,0,6.08,1.34,0.25))
  boundary capInside = cap
  colour capColour = 38+42*clamp(x,0,0.7)~25+25*clamp(x,0,0.7)~31+27*clamp(x,0,0.7)
  transparency capFade = clamp(1-25*x,0,1)
  draw(cap,colour=capColour,transparency=capFade)
  expression capShade = min(cap,0.16-x)
  colour capShadeColour = 11~8~13
  transparency capShadeFade = clamp(1-10*x,0.44,1)
  draw(capShade,colour=capShadeColour,boundary=capInside,transparency=capShadeFade)
  expression capHighlight = min(cap,0.12-abs(x+0.48))
  colour capHighlightColour = 105~57~64
  transparency capHighlightFade = clamp(1-14*x,0.72,1)
  draw(capHighlight,colour=capHighlightColour,boundary=capInside,transparency=capHighlightFade)
}`,
  marble: `set x_min = -8
set x_max = 8
set y_min = -8
set y_max = 8
set max_recursion = 100
set angle_mode = radians
set background_color = 0
set ensure_square_grid = True
set aspect_ratio = 1:1
set draw_only_inside_boundary = False
set show_coordinate_grid = False
set show_grid = False
set show_x_axis = False
set show_y_axis = False
set show_x_numbers = False
set show_y_numbers = False
set unbounded_decimal_places = 3
set random_seed = 803417
folder Rotation controls = {
  slider yAngle = 0.65 range -3.14~3.14
  slider xAngle = 0.45 range -1.57~1.57
  slider zAngle = -0.12 range -3.14~3.14
}
folder Rotation and material functions = {
  function rotateA(u,v,angle) = cos(angle)*u-sin(angle)*v
  function rotateB(u,v,angle) = sin(angle)*u+cos(angle)*v
  function marbleLayer(px,py,pz,scale,phase) = 0.52*sin(scale*(0.73*px+0.31*py+0.52*pz)+phase+0.35*sin(scale*(0.27*px-0.81*py+0.44*pz)+1.7*phase))+0.31*sin(scale*(-0.41*px+0.86*py+0.23*pz)-1.3*phase+0.28*cos(scale*(0.64*px+0.17*py-0.71*pz)))+0.17*cos(scale*(0.19*px-0.48*py+0.91*pz)+0.7*phase)
}
folder Scene = {
  expression room = y
  colour roomColour = 14+2*clamp(x,0,1)~16+2*clamp(x,0,1)~20+3*clamp(x,0,1)
  draw(room,colour=roomColour)
  expression backdropGlow = frac{1}{e^(frac{x^2}{34}+frac{(y-0.4)^2}{48})}
  colour backdropGlowColour = 63+38*clamp(x,0,1)~69+40*clamp(x,0,1)~77+43*clamp(x,0,1)
  transparency backdropGlowFade = clamp(0.98-0.16*clamp(x,0,1),0.82,1)
  draw(backdropGlow,colour=backdropGlowColour,transparency=backdropGlowFade)
  expression basePlane = -4.55-y
  colour floorColour = 20+12*clamp(x,0,1)~22+13*clamp(x,0,1)~25+15*clamp(x,0,1)
  transparency floorFade = clamp(1-22*x,0,1)
  draw(basePlane,colour=floorColour,transparency=floorFade)
  expression baseShadow = min(basePlane+0.08,1-frac{x^2}{20}-frac{(y+4.5)^2}{0.42})
  colour floorShadowColour = 2~3~4
  transparency floorShadowFade = clamp(1-8*x,0.32,1)
  draw(baseShadow,colour=floorShadowColour,transparency=floorShadowFade)
}
folder Ray setup = {
  expression cubeSize = 2.75
  expression screenX = x
  expression screenY = y+0.25
  expression cameraZ = 10
  expression rolledOX = rotateA(screenX,screenY,0-zAngle)
  expression rolledOY = rotateB(screenX,screenY,0-zAngle)
  expression pitchedOY = rotateA(rolledOY,cameraZ,0-xAngle)
  expression pitchedOZ = rotateB(rolledOY,cameraZ,0-xAngle)
  expression rayOX = rotateA(rolledOX,pitchedOZ,0-yAngle)
  expression rayOY = pitchedOY
  expression rayOZ = rotateB(rolledOX,pitchedOZ,0-yAngle)
  expression pitchedDY = rotateA(0,-1,0-xAngle)
  expression pitchedDZ = rotateB(0,-1,0-xAngle)
  expression rayDX = rotateA(0,pitchedDZ,0-yAngle)
  expression rayDY = pitchedDY
  expression rayDZ = rotateB(0,pitchedDZ,0-yAngle)
  expression invdx = sign(rayDX+0.0001)*e^(-ln(abs(rayDX)+0.001))
  expression invdy = sign(rayDY+0.0001)*e^(-ln(abs(rayDY)+0.001))
  expression invdz = sign(rayDZ+0.0001)*e^(-ln(abs(rayDZ)+0.001))
  expression slabX0 = (0-cubeSize-rayOX)*invdx
  expression slabX1 = (cubeSize-rayOX)*invdx
  expression slabY0 = (0-cubeSize-rayOY)*invdy
  expression slabY1 = (cubeSize-rayOY)*invdy
  expression slabZ0 = (0-cubeSize-rayOZ)*invdz
  expression slabZ1 = (cubeSize-rayOZ)*invdz
  expression rayNear = max(max(min(slabX0,slabX1),min(slabY0,slabY1)),min(slabZ0,slabZ1))
  expression rayFar = min(min(max(slabX0,slabX1),max(slabY0,slabY1)),max(slabZ0,slabZ1))
  expression cubeHit = min(rayFar-rayNear,rayNear)
  boundary cubeVisible = cubeHit
  expression localX = rayOX+rayDX*rayNear
  expression localY = rayOY+rayDY*rayNear
  expression localZ = rayOZ+rayDZ*rayNear
}
folder Visible faces = {
  expression distanceX = abs(abs(localX)-cubeSize)
  expression distanceY = abs(abs(localY)-cubeSize)
  expression distanceZ = abs(abs(localZ)-cubeSize)
  expression faceX = min(cubeHit,min(distanceY-distanceX,distanceZ-distanceX))
  expression faceY = min(cubeHit,min(distanceX-distanceY,distanceZ-distanceY))
  expression faceZ = min(cubeHit,min(distanceX-distanceZ,distanceY-distanceZ))
  expression faceXP = min(faceX,localX)
  expression faceXN = min(faceX,0-localX)
  expression faceYP = min(faceY,localY)
  expression faceYN = min(faceY,0-localY)
  expression faceZP = min(faceZ,localZ)
  expression faceZN = min(faceZ,0-localZ)
  boundary showXP = faceXP
  boundary showXN = faceXN
  boundary showYP = faceYP
  boundary showYN = faceYN
  boundary showZP = faceZP
  boundary showZN = faceZN
}
folder Object space marble = {
  expression calciteCloud = 0.55*sin(0.31*localX+0.23*localY+0.39*localZ)+0.28*cos(0.47*localY-0.29*localZ)+0.17*sin(0.61*localZ-0.19*localX)
  expression veinWarp = 0.72*sin(0.43*localX-0.31*localY+0.37*localZ)+0.39*cos(0.67*localY+0.29*localZ)+0.21*sin(1.17*localX-0.83*localZ)
  expression majorDistance = abs(sin(0.39*localX+0.14*localY+0.28*localZ+1.52*veinWarp)+0.2*sin(0.91*localX-0.57*localY+0.7*localZ))
  expression branchDistance = abs(sin(2.37*localX-1.49*localY+1.91*localZ+0.46*veinWarp+0.27*sin(3.17*localY-2.23*localZ)))
  expression veinStrength = clamp(0.82+0.1*sin(2.11*localX-1.37*localY+0.83*localZ)+0.08*cos(3.07*localY+1.73*localZ),0.58,1)
  expression stoneCloud = clamp(0.975+0.025*calciteCloud-veinStrength*(0.78*e^(-((majorDistance/0.15)^2))+0.24*e^(-((majorDistance/0.54)^2))+0.38*e^(-((branchDistance/0.075)^2))+0.09*e^(-((branchDistance/0.27)^2))),0.03,1)
}
folder Rotated lighting and stone surface = {
  expression rolledLightX = rotateA(-0.42,0.74,0-zAngle)
  expression rolledLightY = rotateB(-0.42,0.74,0-zAngle)
  expression pitchedLightY = rotateA(rolledLightY,0.52,0-xAngle)
  expression pitchedLightZ = rotateB(rolledLightY,0.52,0-xAngle)
  expression objectLightX = rotateA(rolledLightX,pitchedLightZ,0-yAngle)
  expression objectLightY = pitchedLightY
  expression objectLightZ = rotateB(rolledLightX,pitchedLightZ,0-yAngle)
  expression lightXP = 0.76+0.24*clamp(objectLightX,0,1)
  expression lightXN = 0.76+0.24*clamp(0-objectLightX,0,1)
  expression lightYP = 0.76+0.24*clamp(objectLightY,0,1)
  expression lightYN = 0.76+0.24*clamp(0-objectLightY,0,1)
  expression lightZP = 0.76+0.24*clamp(objectLightZ,0,1)
  expression lightZN = 0.76+0.24*clamp(0-objectLightZ,0,1)
  colour marbleXP = (15+240*x)*lightXP~(17+236*x)*lightXP~(20+229*x)*lightXP
  colour marbleXN = (15+240*x)*lightXN~(17+236*x)*lightXN~(20+229*x)*lightXN
  colour marbleYP = (15+240*x)*lightYP~(17+236*x)*lightYP~(20+229*x)*lightYP
  colour marbleYN = (15+240*x)*lightYN~(17+236*x)*lightYN~(20+229*x)*lightYN
  colour marbleZP = (15+240*x)*lightZP~(17+236*x)*lightZP~(20+229*x)*lightZP
  colour marbleZN = (15+240*x)*lightZN~(17+236*x)*lightZN~(20+229*x)*lightZN
  draw(stoneCloud,colour=marbleXP,boundary=showXP)
  draw(stoneCloud,colour=marbleXN,boundary=showXN)
  draw(stoneCloud,colour=marbleYP,boundary=showYP)
  draw(stoneCloud,colour=marbleYN,boundary=showYN)
  draw(stoneCloud,colour=marbleZP,boundary=showZP)
  draw(stoneCloud,colour=marbleZN,boundary=showZN)
}
folder Cube edges = {
  expression edgeX = min(faceX,0.075-min(cubeSize-abs(localY),cubeSize-abs(localZ)))
  expression edgeY = min(faceY,0.075-min(cubeSize-abs(localX),cubeSize-abs(localZ)))
  expression edgeZ = min(faceZ,0.075-min(cubeSize-abs(localX),cubeSize-abs(localY)))
  expression cubeEdges = max(max(edgeX,edgeY),edgeZ)
  colour edgeColour = 48~54~57
  transparency edgeFade = clamp(1-54*x,0.36,1)
  draw(cubeEdges,colour=edgeColour,boundary=cubeVisible,transparency=edgeFade)
}`
};

for (const link of document.querySelectorAll("[data-sample]")) {
  const sampleId = link.dataset.sample;
  const scene = sampleScenes[sampleId];
  if (!scene) continue;
  link.href = ["fire", "mandelbrot", "tree", "lava", "marble"].includes(sampleId)
    ? `./app.html?sample=${encodeURIComponent(sampleId)}&v=${APP_VERSION}`
    : `./app.html?scene=${encodeURIComponent(scene)}&v=${APP_VERSION}`;
}

for (const link of document.querySelectorAll('[data-launch-blank]')) {
  link.href = `./app.html?v=${APP_VERSION}`;
}
