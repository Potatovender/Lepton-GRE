const sampleScenes = {
  fire: `F:eq~arctan(2sin(-2x-y/8+cos(3y-x-sin(cos(sin(sin(x*y)+x))+x-y+arccot(x)*arctan(y))))+frac{(x^{2}+frac{y^{2}}{14})}{3}-(frac{100}{x^{2}+y^{2}})+e^{-4-y})
F:r~150((x-(cos(3.7(x+0.8))/3))/3.4+0.9)
F:g~70(sin(1.35(x+pi/2))/3.5+0.28)
F:b~18(e^(-(3(x+0.99))^2)/4-x/14+0.03)
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
  water: `F:eq~sin(sqrt(x^2+y^2)*4.8+0.6*sin(x))+0.55*cos(x*1.6-y*1.35)
F:r~30+35*sin(eq+x/6)
F:g~105+65*cos(eq/2+y/7)
F:b~185+55*sin(eq-y/6)
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
  stars: `F:eq~abs(sin(4x)cos(4y))+0.22sin(x*y)-0.86
F:r~12+26sin(x/2)+220exp(-(eq^2)/0.018)
F:g~18+24cos(y/3)+220exp(-(eq^2)/0.014)
F:b~45+34sin((x+y)/4)+210exp(-(eq^2)/0.012)
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
