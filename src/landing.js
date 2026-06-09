const sampleScenes = {
  fire: `F:eq~arctan(2sin(-2x-y/8+cos(3y-x-sin(cos(sin(sin(x*y)+x))+x-y+arccot(x)*arctan(y))))+frac{(x^{2}+frac{y^{2}}{14})}{3}-(frac{100}{x^{2}+y^{2}})+e^{-4-y})
F:r~255((-x-(cos(3.7(-x+0.8))/3))/2.8+1.28)
F:g~255(sin(1.5(-x+pi/2))/2.8+0.5)
F:b~255(e^(-(3(-x+0.99))^2)/3+x/9+0.1)
F:rest~1
~~~~~
C:rgb~r~g~b
~~~~~
R:rest~rest~0
~~~~~
D~eq~rgb~rest~0
~~~~~
S:x_min~-15
S:x_max~15
S:y_min~-15
S:y_max~15
S:max_recursion~100
S:angle_mode~radians`,
  mandelbrot: `F:real~real^2-imaginary^2+x
F:imaginary~2*real*imaginary+y
F:one~1
F:combined~real^2+imaginary^2
F:rest~combined-4
~~~~~
C:rgb~one~one~one
~~~~~
R:rest~rest~1
~~~~~
D~combined~rgb~rest~0
~~~~~
S:x_min~-2
S:x_max~1
S:y_min~-2
S:y_max~2
S:max_recursion~12
S:angle_mode~radians`,
  water: `F:eq~sin(sqrt(x^2+y^2)*4)+cos(x*2-y*1.5)
F:r~120+80*sin(eq)
F:g~150+90*cos(x/2)
F:b~210+40*sin(y/2)
F:rest~1
~~~~~
C:rgb~r~g~b
~~~~~
R:rest~rest~0
~~~~~
D~eq~rgb~rest~0
~~~~~
S:x_min~-12
S:x_max~12
S:y_min~-8
S:y_max~8
S:max_recursion~40
S:angle_mode~radians`,
  stars: `F:rad~sqrt(x^2+y^2)
F:theta~arctan(y/(x+0.02))
F:arm~(0.5+0.5*sin(3*theta+2.4*rad))*e^(0-rad^2/85)
F:core~e^(0-rad^2/9)
F:spark~e^(0-(abs(sin(11.7*x+2.3*sin(y)))+abs(cos(10.9*y+1.7*sin(x))))/0.055)
F:eq~arm+core+0.35*spark
F:r~8+105*arm+240*core+180*spark
F:g~10+70*arm+150*core+170*spark
F:b~30+180*arm+230*core+220*spark
F:rest~1
~~~~~
C:rgb~r~g~b
~~~~~
R:rest~rest~0
~~~~~
D~eq~rgb~rest~0
~~~~~
S:x_min~-12
S:x_max~12
S:y_min~-8
S:y_max~8
S:max_recursion~40
S:angle_mode~radians`
};

for (const link of document.querySelectorAll("[data-sample]")) {
  const scene = sampleScenes[link.dataset.sample];
  if (!scene) continue;
  link.href = `./app.html?scene=${encodeURIComponent(scene)}`;
}
