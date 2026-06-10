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
F:fade~e^(0-rad^2/18)
F:theta~arctan(y/(x+0.02))
F:swirl~0.5+0.5*sin(3*theta+2.8*rad)
F:core~e^(0-rad^2/3.5)
F:spark~e^(0-(abs(sin(12.7*x+2.1*sin(y)))+abs(cos(13.3*y+1.9*sin(x))))/0.045)*fade
F:eq~fade*swirl+core+0.35*spark
F:r~5+95*fade*swirl+235*core+175*spark
F:g~8+65*fade*swirl+145*core+165*spark
F:b~28+175*fade*swirl+225*core+225*spark
F:rest~1
~~~~~
C:rgb~r~g~b
~~~~~
R:rest~rest~0
~~~~~
D~eq~rgb~rest~0
~~~~~
S:x_min~-8
S:x_max~8
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
