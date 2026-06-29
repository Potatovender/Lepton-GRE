import { describe, expect, test } from "vitest";
import { createDefaultScene, exportScene, importScene } from "../src/model/scene";

const sample = `F:eq~x+y
~~~~~
C:rgb~255~0~128
~~~~~
R:rest~x^2+y^2-4~0
~~~~~
D~eq~rgb~rest
~~~~~
S:x_min~-2
S:x_points~20
S:x_max~2
S:y_min~-3
S:y_points~30
S:y_max~3
S:max_recursion~12
S:angle_mode~degrees`;

describe("scene import/export", () => {
  test("imports functions, colors, restrictions, draw rows, and settings", () => {
    const scene = importScene(sample);
    expect(scene.functions).toEqual([{ id: "eq", kind: "variable", expression: "x+y" }]);
    expect(scene.colors).toEqual([{ id: "rgb", red: "255", green: "0", blue: "128" }]);
    expect(scene.restrictions).toEqual([{ id: "rest", expression: "x^2+y^2-4", checkSmaller: false }]);
    expect(scene.draws).toEqual([{ equationId: "eq", colorId: "rgb", restrictionId: "rest" }]);
    expect(scene.settings.angleMode).toBe("degrees");
    expect(scene.settings.maxRecursion).toBe(12);
  });

  test("exports a scene using the new typed text language", () => {
    const scene = importScene(sample);
    expect(exportScene(scene)).toContain("variable eq = x+y");
    expect(exportScene(scene)).toContain("draw(eq,rgb,rest,False)");
    expect(exportScene(scene)).toContain("set angle_mode = degrees");
  });

  test("round-trips variables, sliders, time variables, and functions", () => {
    const scene = importScene(`variable a = x
slider speed = 5 range -2~8
time bounded_looped t = 0 range 0~12
function f(x,banana) = x+banana`);
    expect(scene.functions).toEqual([
      { id: "a", kind: "variable", expression: "x" },
      { id: "speed", kind: "slider", expression: "5", sliderMin: "-2", sliderMax: "8", time: false },
      { id: "t", kind: "slider", expression: "0", sliderMin: "0", sliderMax: "12", time: true, timeMode: "bounded_looped" },
      { id: "f", kind: "function", expression: "x+banana", params: ["x", "banana"] }
    ]);
    const exported = exportScene(scene);
    expect(exported).toContain("variable a = x");
    expect(exported).toContain("slider speed = 5 range -2~8");
    expect(exported).toContain("time bounded_looped t = 0 range 0~12");
    expect(exported).toContain("function f(x,banana) = x+banana");
  });

  test("creates a default scene with one drawable equation", () => {
    const scene = createDefaultScene();
    expect(scene.functions[0].id).toBe("eq");
    expect(scene.colors[0].id).toBe("rgb");
    expect(scene.draws.length).toBe(1);
  });
});
