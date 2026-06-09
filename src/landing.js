const sampleScenes = {
  fire: `F:eq~arctan(2sin(-2x-y/8+cos(3y-x-sin(cos(sin(sin(x*y)+x))+x-y+arccot(x)*arctan(y))))+frac{(x^{2}+frac{y^{2}}{14})}{3}-(frac{100}{x^{2}+y^{2}})+e^{-4-y})
F:r~135((x-(cos(3.7(x+0.8))/3))/3.15+0.9)
F:g~38(sin(1.5(x+pi/2))/3.15+0.32)
F:b~12(e^(-(3(x+0.99))^2)/3.5-x/12+0.03)
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
  stars: `F:eq~sin(2.3*x+4.1*sin(y))+cos(3.7*y+1.9*sin(x))+sin(1.7*x*y)
F:star~e^(0-((abs(eq)-2.45)^2)/0.018)
F:nebula~e^(0-(x^2+y^2)/85)
F:arm~0.5+0.5*sin(2.4*sqrt(x^2+y^2)+0.32*x-0.2*y)
F:r~8+230*star+38*nebula*arm+10*sin(y/3)
F:g~10+220*star+32*nebula*arm
F:b~30+255*star+120*nebula+20*sin(x/4)
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
