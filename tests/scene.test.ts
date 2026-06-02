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
    expect(scene.functions).toEqual([{ id: "eq", expression: "x+y" }]);
    expect(scene.colors).toEqual([{ id: "rgb", red: "255", green: "0", blue: "128" }]);
    expect(scene.restrictions).toEqual([{ id: "rest", expression: "x^2+y^2-4", checkSmaller: false }]);
    expect(scene.draws).toEqual([{ equationId: "eq", colorId: "rgb", restrictionId: "rest" }]);
    expect(scene.settings.angleMode).toBe("degrees");
    expect(scene.settings.maxRecursion).toBe(12);
  });

  test("exports a scene using the legacy text sections", () => {
    const scene = importScene(sample);
    expect(exportScene(scene)).toContain("F:eq~x+y");
    expect(exportScene(scene)).toContain("D~eq~rgb~rest");
    expect(exportScene(scene)).toContain("S:angle_mode~degrees");
  });

  test("creates a default scene with one drawable equation", () => {
    const scene = createDefaultScene();
    expect(scene.functions[0].id).toBe("eq");
    expect(scene.colors[0].id).toBe("rgb");
    expect(scene.draws.length).toBe(1);
  });
});
