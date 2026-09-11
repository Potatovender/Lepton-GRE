// Typed collection plans reuse Lepton's scalar compiler. Lists are lazy in GLSL:
// a length and an element evaluator, rather than an array allocated per pixel.
export function rangeLength(lower, upper) {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) throw new Error("Range bounds must be finite scalars");
  const length = Math.max(0, Math.floor(upper - lower) + 1);
  if (!Number.isSafeInteger(length)) throw new Error("Range is too large for numeric precision");
  return length;
}

export function collectionSizeError(maximum) {
  const error = new Error(`List exceeds maximum list size (${maximum.toLocaleString()}); graph may not render`);
  error.code = "LIST_SIZE";
  return error;
}

// Apply identifier transformations only to free names, never a loop's local
// binding. Bounds use the outer scope; the body uses the newly bound index.
export function mapScopedNames(node, transform, locals = new Set()) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((part) => mapScopedNames(part, transform, locals));
  if (node.type === "aggregate" || node.type === "comprehension") return {
    ...node, lower: mapScopedNames(node.lower, transform, locals), upper: mapScopedNames(node.upper, transform, locals),
    body: mapScopedNames(node.body, transform, new Set([...locals, node.binding]))
  };
  const result = Object.fromEntries(Object.entries(node).map(([key, value]) => [key, typeof value === "object" ? mapScopedNames(value, transform, locals) : value]));
  if ((node.type === "identifier" || node.type === "call") && !locals.has(node.name)) result.name = transform(node.name);
  return result;
}

/**
 * The host supplies the existing parser, definitions, scalar CPU/GLSL compilers,
 * and scene limits. Returned evaluate/length/cost methods accept {x,y,env,locals}.
 * Locals are lexical bindings; global references always start in a fresh scope.
 */
export function buildCollectionPlan(source, host, initialLocals = new Map()) {
  let localSequence = 0;
  const referenceMemo = new Map();
  const scalar = (source, args = []) => ({ kind: "scalar", tag: "scalar", source, args,
    evaluate: host.scalarCpu(source, args.map((_, i) => `lcslot${i}`)) });
  const lift = (source, args) => {
    const lists = args.filter((arg) => arg.kind === "list");
    if (args.some((arg) => arg.kind === "point")) {
      if (lists.length || !["(lcslot0)+(lcslot1)", "(lcslot0)*(lcslot1)"].includes(source)) throw new Error("Point arithmetic supports scalar/point addition and multiplication, not lists");
      return { kind: "point", tag: "point", items: [0,1].map((i) => lift(source, args.map((arg) => arg.kind === "point" ? { kind: "scalar", tag: "index", target: arg, index: scalar(String(i)) } : arg))) };
    }
    return { ...scalar(source, args), kind: lists.length ? "list" : "scalar", tag: "lift" };
  };
  const visit = (node, locals, stack) => {
    if (node.type === "number") {
      if (!Number.isFinite(node.value)) throw new Error("Numeric literal must be finite");
      return { kind: "scalar", tag: "number", value: node.value };
    }
    if (node.type === "identifier") {
      const name = node.name.replace(/^~|~$/g, "");
      if (locals.has(name)) return locals.get(name);
      if (name === "random") return scalar("random()");
      const entry = host.definition(name);
      if (entry && !(entry.kind === "slider" && entry.time)) {
        if (stack.length >= host.maxRecursion) return scalar("0");
        if (entry.kind === "function") {
          const params = new Map(entry.params.map((param) => [param, scalar(param === "x" || param === "y" ? param : "0")]));
          return visit(host.parse(entry.expression), params, [...stack, name]);
        }
        const key = `${name}:${stack.length}`;
        let result = referenceMemo.get(key);
        if (!result) {
          result = visit(host.parse(entry.expression), new Map(), [...stack, name]);
          referenceMemo.set(key, result);
        }
        if (entry.kind === "list" && result.kind !== "list") throw new Error(`List ${name} must contain a list expression`);
        return result;
      }
      const point = host.point(name);
      if (point) {
        if (stack.includes(`point:${name}`)) throw new Error(`Circular point reference: ${name}`);
        const items = [point.x, point.y].map((part) => visit(host.parse(part), new Map(), [...stack, `point:${name}`]));
        if (items.some((item) => item.kind !== "scalar")) throw new Error(`Point ${name} coordinates must be scalars`);
        return { kind: "point", tag: "point", fixed: true, items };
      }
      host.checkScalar(name);
      return scalar(name);
    }
    if (node.type === "list") {
      const items = node.items.map((item) => visit(item, locals, stack));
      if (items.some((item) => item.kind !== "scalar")) throw new Error("Lists currently contain only scalars, not points or nested lists");
      return { kind: "list", tag: "list", items };
    }
    if (node.type === "aggregate" || node.type === "comprehension") {
      const lower = visit(node.lower, locals, stack), upper = visit(node.upper, locals, stack);
      if (lower.kind !== "scalar" || upper.kind !== "scalar") throw new Error("Range bounds must be scalars");
      const binding = `lcindex${localSequence++}`;
      const local = { kind: "scalar", tag: "local", binding };
      const body = visit(node.body, new Map([...locals, [node.binding, local]]), stack);
      if (body.kind === "point" || (node.type === "comprehension" && body.kind !== "scalar")) throw new Error("Comprehensions currently produce scalar list elements");
      return { kind: node.type === "comprehension" ? "list" : body.kind, tag: node.type, name: node.name, binding, lower, upper, body };
    }
    if (node.type === "index" || node.type === "member") {
      const target = visit(node.target, locals, stack);
      if (node.type === "member" && node.property === "length") {
        if (target.kind !== "list") throw new Error("Only lists have a length property");
        return { kind: "scalar", tag: "length", target };
      }
      const index = node.type === "member" ? scalar(node.property === "x" ? "0" : "1") : visit(node.index, locals, stack);
      if (node.type === "member" && target.kind !== "point") throw new Error("Use [index] for a list element; .x and .y belong to points");
      if (target.kind === "scalar" || index.kind !== "scalar") throw new Error("Indexing needs a list or point and a scalar index");
      return { kind: "scalar", tag: "index", target, index };
    }
    if (node.type === "call") {
      const args = node.args.map((arg) => visit(arg, locals, stack));
      const entry = host.definition(node.name);
      if (entry?.kind === "function") {
        let expanded = args.flatMap((arg) => arg.kind === "point" ? [0,1].map((i) => ({ kind: "scalar", tag: "index", target: arg, index: scalar(String(i)) })) : [arg]);
        // Preserve legacy inline point arguments only when scalar arity requires
        // them. Named lists are never flattened into function parameters.
        if (expanded.length !== entry.params.length) {
          const legacy = args.flatMap((arg, index) => node.args[index].type === "list" && arg.items?.length === 2 ? arg.items : arg.kind === "point" ? [0,1].map((i) => ({ kind: "scalar", tag: "index", target: arg, index: scalar(String(i)) })) : [arg]);
          if (legacy.length === entry.params.length) expanded = legacy;
        }
        if (expanded.length !== entry.params.length) throw new Error(`Function ${node.name} expects ${entry.params.length} inputs`);
        if (stack.length >= host.maxRecursion) return scalar("0");
        const result = visit(host.parse(entry.expression), new Map(entry.params.map((param, i) => [param, expanded[i]])), [...stack, node.name]);
        if (entry.outputType === "point") {
          if (!["list", "point"].includes(result.tag) || result.items.length !== 2) throw new Error(`Point function ${node.name} must return [x,y]`);
          return { ...result, kind: "point", tag: "point" };
        }
        return result;
      }
      host.checkCall(node.name, args.length);
      return lift(`${node.name}(${args.map((_, i) => `lcslot${i}`).join(",")})`, args);
    }
    if (node.type === "piecewise") {
      const branches = node.branches.map(({ condition, value }) => ({ condition: visit(host.condition(condition), locals, stack), value: visit(value, locals, stack) }));
      if (branches.some((branch) => branch.condition.kind !== "scalar" || branch.value.kind !== "scalar")) throw new Error("Piecewise list elements must be scalars");
      const fallback = node.fallback ? visit(node.fallback, locals, stack) : null;
      if (fallback && fallback.kind !== "scalar") throw new Error("Piecewise fallback must be a scalar");
      return { kind: "scalar", tag: "piecewise", branches, fallback };
    }
    if (node.type === "unary") return lift(`${node.op}(lcslot0)`, [visit(node.value, locals, stack)]);
    const parts = node.type === "fraction" ? [node.num, node.den] : node.type === "power" ? [node.base, node.exponent] : [node.left, node.right];
    if (!parts.every(Boolean)) throw new Error(`Unsupported collection expression: ${node.type}`);
    const op = node.type === "fraction" ? "/" : node.type === "power" ? "^" : node.op;
    if (["=", "==", "!=", "<", ">", "<=", ">="].includes(op)) {
      const args = parts.map((part) => visit(part, locals, stack));
      if (args.some((arg) => arg.kind !== "scalar")) throw new Error("Compare list elements individually with [index]");
      return { kind: "scalar", tag: "comparison", op: op === "=" ? "==" : op, args };
    }
    return lift(`(lcslot0)${op}(lcslot1)`, parts.map((part) => visit(part, locals, stack)));
  };
  const plan = visit(host.parse(source), initialLocals, []);
  const maximum = host.maxListSize;
  const checkLength = (length) => {
    if (length > maximum) throw collectionSizeError(maximum);
    return length;
  };
  const evaluate = (node, ctx) => {
    if (node.tag === "number") return node.value;
    if (node.tag === "comparison") {
      const [a, b] = node.args.map((arg) => evaluate(arg, ctx));
      return Number(({ "==": () => a === b, "!=": () => a !== b, "<": () => a < b, ">": () => a > b, "<=": () => a <= b, ">=": () => a >= b })[node.op]());
    }
    if (node.tag === "piecewise") {
      for (const branch of node.branches) if (evaluate(branch.condition, ctx)) return evaluate(branch.value, ctx);
      return node.fallback ? evaluate(node.fallback, ctx) : NaN;
    }
    if (node.tag === "local") return ctx.locals[node.binding];
    if (node.tag === "scalar") return node.evaluate(ctx, []);
    if (node.tag === "list" || node.tag === "point") {
      if (node.kind === "list") checkLength(node.items.length);
      return node.items.map((item) => evaluate(item, node.fixed ? { ...ctx, x: 0, y: 0 } : ctx));
    }
    if (node.tag === "length") return length(node.target, ctx);
    if (node.tag === "index") {
      const values = evaluate(node.target, ctx), index = evaluate(node.index, ctx);
      return Number.isInteger(index) && index >= 0 && index < values.length ? values[index] : NaN;
    }
    if (node.tag === "lift") {
      const args = node.args.map((arg) => evaluate(arg, ctx));
      const arrays = args.filter(Array.isArray);
      if (!arrays.length) return node.evaluate(ctx, args);
      const size = checkLength(arrays[0].length);
      if (arrays.some((array) => array.length !== size)) throw new Error("List lengths must match for element-wise operations");
      return Array.from({ length: size }, (_, index) => node.evaluate(ctx, args.map((arg) => Array.isArray(arg) ? arg[index] : arg)));
    }
    const lower = evaluate(node.lower, ctx), upper = evaluate(node.upper, ctx);
    const size = rangeLength(lower, upper);
    const scoped = (index) => ({ ...ctx, locals: { ...ctx.locals, [node.binding]: index } });
    if (node.tag === "comprehension") {
      checkLength(size);
      return Array.from({ length: size }, (_, i) => evaluate(node.body, scoped(lower + i)));
    }
    const identity = node.name === "sum" ? 0 : 1;
    let result = node.kind === "list" ? Array(length(node.body, scoped(lower))).fill(identity) : identity;
    for (let i = 0; i < size; i += 1) {
      const value = evaluate(node.body, scoped(lower + i));
      if (Array.isArray(result)) {
        if (value.length !== result.length) throw new Error("List lengths must match across summation/product terms");
        result = result.map((part, index) => node.name === "sum" ? part + value[index] : part * value[index]);
      } else result = node.name === "sum" ? result + value : result * value;
    }
    return result;
  };
  const length = (node, ctx) => {
    if (node.items) return node.kind === "point" ? 2 : checkLength(node.items.length);
    if (node.tag === "lift") {
      const sizes = node.args.filter((arg) => arg.kind === "list").map((arg) => length(arg, ctx));
      if (sizes.some((size) => size !== sizes[0])) throw new Error("List lengths must match for element-wise operations");
      return sizes[0];
    }
    if (node.tag === "comprehension") return checkLength(rangeLength(evaluate(node.lower, ctx), evaluate(node.upper, ctx)));
    return length(node.body, { ...ctx, locals: { ...ctx.locals, [node.binding]: evaluate(node.lower, ctx) } });
  };
  const costCache = new WeakMap();
  const bindingCache = new WeakMap(), workCache = new WeakMap();
  const memoizedQuery = (cache, node, binding, compute) => {
    const entries = cache.get(node) ?? new Map();
    if (entries.has(binding)) return entries.get(binding);
    const result = compute();
    entries.set(binding, result); cache.set(node, entries);
    return result;
  };
  const usesBinding = (node, binding) => memoizedQuery(bindingCache, node, binding, () => node.tag === "local" && node.binding === binding || Object.values(node).some((value) => Array.isArray(value) ? value.some((part) => part?.tag && usesBinding(part, binding)) : value?.tag && usesBinding(value, binding)));
  const variableWork = (node, binding) => {
    return memoizedQuery(workCache, node, binding, () => {
      if (node.lower && (usesBinding(node.lower, binding) || usesBinding(node.upper, binding))) return true;
      return Object.values(node).some((value) => Array.isArray(value) ? value.some((part) => part?.tag && variableWork(part, binding)) : value?.tag && variableWork(value, binding));
    });
  };
  const cost = (node, ctx) => {
    const key = JSON.stringify([ctx.x, ctx.y, ctx.locals]);
    const cached = costCache.get(node);
    if (cached?.key === key) return cached.value;
    const value = Math.min(65537, nodeCost(node, ctx));
    costCache.set(node, { key, value });
    return value;
  };
  const nodeCost = (node, ctx) => {
    if (node.tag === "piecewise") return 1 + node.branches.reduce((total, branch) => total + cost(branch.condition, ctx) + cost(branch.value, ctx), 0) + (node.fallback ? cost(node.fallback, ctx) : 0);
    if (["scalar", "local", "number"].includes(node.tag)) return 1;
    if (node.items) return 1 + node.items.reduce((total, item) => total + cost(item, ctx), 0);
    if (node.args) return (node.kind === "list" ? length(node, ctx) : 1) + node.args.reduce((total, arg) => total + cost(arg, ctx), 0);
    if (node.target) return 1 + cost(node.target, ctx) + (node.index ? cost(node.index, ctx) : 0);
    const boundCost = cost(node.lower, ctx) + cost(node.upper, ctx);
    if (boundCost > 4096) return Infinity;
    const lower = evaluate(node.lower, ctx), upper = evaluate(node.upper, ctx);
    const size = rangeLength(lower, upper);
    if (variableWork(node.body, node.binding)) {
      let total = boundCost;
      for (let index = 0; index < size && total <= 65536; index++) total += 1 + cost(node.body, { ...ctx, locals: { ...ctx.locals, [node.binding]: lower + index } });
      return total;
    }
    return boundCost + size * (1 + cost(node.body, { ...ctx, locals: { ...ctx.locals, [node.binding]: lower } }));
  };
  const varying = (node) => {
    if (node.tag === "scalar") return (node.source.match(/\b[A-Za-z_]\w*\b/g) ?? []).some((name) => name === "x" || name === "y" || host.definition(name)?.time);
    if (node.tag === "local") return true;
    return Object.values(node).some((value) => Array.isArray(value) ? value.some((part) => part?.tag && varying(part)) : value?.tag && varying(value));
  };
  const dynamicLength = (node) => {
    if (node.items) return false;
    if (node.tag === "lift") return node.args.some((arg) => arg.kind === "list" && dynamicLength(arg));
    if (node.tag === "comprehension") return varying(node.lower) || varying(node.upper);
    return node.body ? dynamicLength(node.body) : false;
  };
  return { plan, kind: plan.kind, dynamicLength: dynamicLength(plan), evaluate: (ctx) => evaluate(plan, ctx), length: (ctx) => length(plan, ctx), cost: (ctx) => cost(plan, ctx), host };
}

// generator is shared across one fragment shader: {helpers: string[], next: 0}.
// Scalar plans return {value}; lists return {size, at(index)}. Helpers are emitted
// in dependency order and receive coordinates/loop locals explicitly.
export function emitCollectionPlan(compiled, generator, context) {
  const { host } = compiled;
  generator.modern = true;
  const nan = "uintBitsToFloat(0x7fc00000u)";
  const guardedSize = (size) => `((${size})>=0.0 && (${size})<=${host.maxListSize}.0 ? (${size}) : ${nan})`;
  const helper = (ctx, body) => {
    const name = `leptonCollection${generator.next++}`;
    const keys = Object.keys(ctx.locals);
    const inner = { x: "lcx", y: "lcy", locals: Object.fromEntries(keys.map((key, i) => [key, `lcarg${i}`])) };
    const source = body(inner);
    generator.helpers.push(`float ${name}(float lcx,float lcy${keys.map((_, i) => `,float lcarg${i}`).join("")}){${source}}`);
    return `${name}(${[ctx.x, ctx.y, ...keys.map((key) => ctx.locals[key])].join(",")})`;
  };
  const scalar = (node, ctx, values = []) => {
    const code = host.scalarGlsl(node.source, { ...ctx.locals, x: ctx.x, y: ctx.y, ...Object.fromEntries(values.map((value, i) => [`lcslot${i}`, value])) });
    // GLSL leaves negative square roots undefined; some drivers return zero.
    return node.source === "sqrt(lcslot0)" ? `((${values[0]})>=0.0 ? (${code}) : ${nan})` : code;
  };
  const emit = (node, ctx) => {
    if (node.tag === "number") return { value: /[.e]/i.test(String(node.value)) ? String(node.value) : `${node.value}.0` };
    if (node.tag === "comparison") return { value: `float((${emit(node.args[0], ctx).value})${node.op}(${emit(node.args[1], ctx).value}))` };
    if (node.tag === "piecewise") {
      let value = node.fallback ? emit(node.fallback, ctx).value : nan;
      for (const branch of [...node.branches].reverse()) value = `((${emit(branch.condition, ctx).value})!=0.0 ? ${emit(branch.value, ctx).value} : ${value})`;
      return { value };
    }
    if (node.tag === "local") return { value: ctx.locals[node.binding] };
    if (node.tag === "scalar") return { value: scalar(node, ctx) };
    if (node.tag === "list" || node.tag === "point") {
      const size = node.kind === "point" ? "2.0" : guardedSize(`${node.items.length}.0`);
      return { size, at: (index) => {
        const items = node.items.map((item) => emit(item, node.fixed ? { ...ctx, x: "0.0", y: "0.0" } : ctx).value);
        return items.reduceRight((result, value, i) => `((${index})==${i}.0 ? (${value}) : ${result})`, nan);
      } };
    }
    if (node.tag === "length") return { value: emit(node.target, ctx).size };
    if (node.tag === "index") {
      const target = emit(node.target, ctx), index = emit(node.index, ctx).value;
      return { value: `((${index})>=0.0 && (${index})<(${target.size}) && floor(${index})==(${index}) ? ${target.at(index)} : ${nan})` };
    }
    if (node.tag === "lift") {
      const args = node.args.map((arg) => emit(arg, ctx));
      const lists = args.filter((arg) => arg.size != null);
      if (!lists.length) return { value: scalar(node, ctx, args.map((arg) => arg.value)) };
      const size = lists.length === 1 ? lists[0].size : `(${lists.slice(1).map((arg) => `(${arg.size})==(${lists[0].size})`).join(" && ")} ? (${lists[0].size}) : ${nan})`;
      return { size, at: (index) => scalar(node, ctx, args.map((arg) => arg.size == null ? arg.value : arg.at(index))) };
    }
    const bounds = (scope) => {
      const lower = emit(node.lower, scope).value, upper = emit(node.upper, scope).value;
      const finite = [lower, upper].map((bound) => `(!isnan(${bound}) && !isinf(${bound}))`).join(" && ");
      return { lower, size: `((${finite}) ? max(0.0,floor((${upper})-(${lower}))+1.0) : ${nan})` };
    };
    if (node.tag === "comprehension") {
      const { lower, size } = bounds(ctx);
      return { size: guardedSize(size), at: (index) => emit(node.body, { ...ctx, locals: { ...ctx.locals, [node.binding]: `((${lower})+(${index}))` } }).value };
    }
    const firstBody = (scope) => emit(node.body, { ...scope, locals: { ...scope.locals, [node.binding]: bounds(scope).lower } });
    const reduction = (ctx, component = null) => {
      const key = `lccomponent${generator.next++}`;
      return helper(component == null ? ctx : { ...ctx, locals: { ...ctx.locals, [key]: component } }, (scope) => {
        const { lower, size } = bounds(scope);
        const body = emit(node.body, { ...scope, locals: { ...scope.locals, [node.binding]: "lcstart+lcterm" } });
        const value = component == null ? body.value : body.at(scope.locals[key]);
        const shapeCheck = component == null ? "" : `if((${body.size})!=(${firstBody(scope).size}))return ${nan};`;
        return `float lcstart=${lower};float lccount=${size};float lcresult=${node.name === "sum" ? "0.0" : "1.0"};
          if(isnan(lccount)||isinf(lccount)||lccount<0.0)return ${nan};
          for(float lcterm=0.0;lcterm<lccount;lcterm+=1.0){
            if(lcterm+1.0==lcterm)return ${nan};${shapeCheck}
            lcresult${node.name === "sum" ? "+=" : "*="}${value};
          }return lcresult;`;
      });
    };
    return node.kind === "list" ? { size: firstBody(ctx).size, at: (index) => reduction(ctx, index) } : { value: reduction(ctx) };
  };
  return emit(compiled.plan, context);
}
