const sampleScenes = {
  fire: `F:eq~arctan(2sin(-2x-y/8+cos(3y-x-sin(cos(sin(sin(x*y)+x))+x-y+arccot(x)*arctan(y))))+frac{(x^{2}+frac{y^{2}}{14})}{3}-(frac{100}{x^{2}+y^{2}})+e^{-4-y})
F:r~255((x-(cos(3.7(x+0.8))/3))/2.8+1.28)
F:g~255(sin(1.5(x+pi/2))/2.8+0.5)
F:b~255(e^(-(3(x+0.99))^2)/3-x/9+0.1)
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
  mandelbrot: `F:real~old^2-imaginary^2+x
F:imaginary~2*old*imaginary+y
F:one~255
F:shade~80+35*(real+imaginary)
F:rest~real^2+imaginary^2-4
F:combined~real^2+imaginary^2
F:old~real
~~~~~
C:rgb~shade~combined~one
~~~~~
R:rest~rest~1
~~~~~
D~combined~rgb~rest~0
~~~~~
S:x_min~-2.4
S:x_max~1.2
S:y_min~-1.5
S:y_max~1.5
S:max_recursion~8
S:angle_mode~radians`,
  ripple: `F:eq~sin(sqrt(x^2+y^2)*4)+cos(x*2-y*1.5)
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
  lattice: `F:eq~sin(2x)+cos(2y)
F:r~150+90*sin(3x)
F:g~180+60*cos(3y)
F:b~255-70*abs(sin(x*y/5))
F:rest~1
~~~~~
C:rgb~r~g~b
~~~~~
R:rest~rest~0
~~~~~
D~eq~rgb~rest~0
~~~~~
S:x_min~-10
S:x_max~10
S:y_min~-7
S:y_max~7
S:max_recursion~40
S:angle_mode~radians`
};

for (const link of document.querySelectorAll("[data-sample]")) {
  const scene = sampleScenes[link.dataset.sample];
  if (!scene) continue;
  link.href = `./app.html?scene=${encodeURIComponent(scene)}`;
}
