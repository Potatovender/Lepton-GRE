import {test} from "node:test";
import assert from "node:assert/strict";
import {renderFrame, disposeRenderer, RendererError} from "../src/index.js";

function fixture({compile = true, link = true, supported = true} = {}) {
  const calls = {programs: 0, shadersDeleted: 0, programsDeleted: 0, buffersDeleted: 0, draws: 0, finishes: 0, uniforms: []};
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, MAX_RENDERBUFFER_SIZE: 5,
    createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => compile,
    getShaderInfoLog: () => "test compile failure", deleteShader() { calls.shadersDeleted++; },
    createProgram() { calls.programs++; return {}; }, attachShader() {}, linkProgram() {}, getProgramParameter: () => link,
    getProgramInfoLog: () => "test link failure", deleteProgram() { calls.programsDeleted++; },
    createBuffer: () => ({}), deleteBuffer() { calls.buffersDeleted++; }, bindBuffer() {}, bufferData() {},
    getAttribLocation: () => 0, getUniformLocation: (_p, name) => name,
    getParameter: () => 4096, viewport() {}, useProgram() {}, enableVertexAttribArray() {}, vertexAttribPointer() {},
    uniform1f(name, value) { calls.uniforms.push([name, value]); }, uniform1i() {}, uniform2f() {}, uniform3f() {}, uniform4f() {},
    clearColor() {}, clear() {}, drawArrays() { calls.draws++; }, finish() { calls.finishes++; }, getExtension: () => null
  };
  const canvas = {width: 0, height: 0, getContext: () => supported ? gl : null};
  const options = {width: 100, height: 50, bounds: {xMin: -2, xMax: 2, yMin: -1, yMax: 1},
    shaderKey: "test", fragmentSource: "void main(){gl_FragColor=vec4(1.0);}", floats: {u_time_0: 1}};
  return {canvas, options, calls};
}

test("same shader updates uniforms without compiling or blocking frames", () => {
  const {canvas, options, calls} = fixture();
  assert.equal(renderFrame(canvas, options).compiled, true);
  assert.equal(renderFrame(canvas, {...options, floats: {u_time_0: 2}}).compiled, false);
  assert.equal(calls.programs, 1); assert.equal(calls.draws, 2); assert.equal(calls.finishes, 0);
  assert.deepEqual(calls.uniforms.at(-1), ["u_time_0", 2]);
  assert.deepEqual([canvas.width, canvas.height], [100, 50]);
});
test("structural changes replace and dispose previous GPU resources", () => {
  const {canvas, options, calls} = fixture();
  renderFrame(canvas, options); renderFrame(canvas, {...options, shaderKey: "other"});
  assert.equal(calls.programsDeleted, 1); assert.equal(calls.buffersDeleted, 1);
  disposeRenderer(canvas); assert.equal(calls.programsDeleted, 2); assert.equal(calls.buffersDeleted, 2);
});
test("readback may explicitly synchronize; normal drawing does not", () => {
  const {canvas, options, calls} = fixture();
  renderFrame(canvas, {...options, synchronous: true, dpr: 2});
  assert.equal(calls.finishes, 1); assert.deepEqual([canvas.width, canvas.height], [200, 100]);
});
test("compile and link failures clean up and report structured errors", () => {
  for (const failure of [{compile: false}, {link: false}]) {
    const {canvas, options, calls} = fixture(failure);
    assert.throws(() => renderFrame(canvas, options), RendererError);
    assert.ok(calls.shadersDeleted > 0); assert.equal(calls.draws, 0);
    if (failure.link === false) assert.equal(calls.programsDeleted, 1);
  }
});
test("missing WebGL reports unsupported without pretending to render", () => {
  const {canvas, options} = fixture({supported: false});
  assert.equal(renderFrame(canvas, options).supported, false);
});
test("invalid ranges, GPU sizes, and shader budgets fail before drawing", () => {
  const {canvas, options, calls} = fixture();
  for (const extra of [{width: 9000}, {width: NaN}, {maxSourceLength: 1}, {bounds: {xMin: 1, xMax: 0, yMin: -1, yMax: 1}}]) {
    assert.throws(() => renderFrame(canvas, {...options, ...extra}), RendererError);
  }
  assert.equal(calls.draws, 0);
});
