// src/server/index.gbln
import http from "node:http";

// src/runtime/vnode.gbln
var TEXT_TYPE = Symbol("GoblinText");
function normalizeChildren(children) {
  const flat = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      flat.push(...normalizeChildren(child));
    } else if (child == null || child === false || child === true) {
      continue;
    } else if (typeof child === "object") {
      flat.push(child);
    } else {
      flat.push(createTextVNode(String(child)));
    }
  }
  return flat;
}
function h(type, props = null, ...children) {
  const normalizedChildren = normalizeChildren(children);
  const key = props && props.key != null ? props.key : null;
  const nextProps = props ? { ...props } : {};
  if (key != null) {
    delete nextProps.key;
  }
  if (normalizedChildren.length > 0) {
    nextProps.children = normalizedChildren.length === 1 ? normalizedChildren[0] : normalizedChildren;
  }
  return {
    type,
    props: nextProps,
    key,
    el: null,
    children: normalizedChildren,
    shapeFlag: typeof type === "string" ? 1 : typeof type === "function" ? 2 : 0
  };
}
function createTextVNode(text) {
  return {
    type: TEXT_TYPE,
    props: {},
    key: null,
    el: null,
    children: text,
    shapeFlag: 0
  };
}

// src/runtime/scheduler.gbln
var queues = {
  immediate: [],
  normal: [],
  idle: []
};
var isFlushing = false;
var jobCounter = 0;
var pendingPostFlushCbs = [];
var nextTick = typeof queueMicrotask === "function" ? queueMicrotask : (cb) => Promise.resolve().then(cb);
function scheduleFlush() {
  if (isFlushing) return;
  isFlushing = true;
  nextTick(runQueues);
}
function runQueues() {
  try {
    flushQueue("immediate");
    flushQueue("normal");
    if (!queues.immediate.length && !queues.normal.length) {
      flushQueue("idle");
    }
    flushPostFlushCbs();
  } finally {
    isFlushing = false;
    if (hasPendingJobs()) {
      scheduleFlush();
    }
  }
}
function flushQueue(priority) {
  const list = queues[priority];
  let entry;
  while (entry = list.shift()) {
    entry.job();
  }
}
function flushPostFlushCbs() {
  if (!pendingPostFlushCbs.length) return;
  const cbs = [...new Set(pendingPostFlushCbs)];
  pendingPostFlushCbs.length = 0;
  for (const cb of cbs) {
    cb();
  }
}
function hasPendingJobs() {
  return queues.immediate.length > 0 || queues.normal.length > 0 || queues.idle.length > 0;
}
function queueJob(job, priority = "normal") {
  const list = queues[priority];
  if (!list.some((entry) => entry.job === job)) {
    list.push({ job, id: jobCounter++ });
    scheduleFlush();
  }
}

// src/runtime/component.gbln
var currentInstance = null;
function getCurrentInstance() {
  return currentInstance;
}
function scheduleComponentUpdate(instance, updateFn) {
  instance.update = () => queueJob(updateFn);
  return instance.update;
}

// src/runtime/hooks.gbln
function assertInstance() {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error("Hooks can only be used inside Goblin function components.");
  }
  return instance;
}
function useState(initialValue) {
  const instance = assertInstance();
  const index = instance.hookIndex++;
  if (!(index in instance.hooks)) {
    const value = typeof initialValue === "function" ? initialValue() : initialValue;
    instance.hooks[index] = value;
  }
  const setState = (nextValue) => {
    const current = instance.hooks[index];
    const value = typeof nextValue === "function" ? nextValue(current) : nextValue;
    if (!Object.is(value, current)) {
      instance.hooks[index] = value;
      if (instance.update) {
        instance.update();
      } else {
        scheduleComponentUpdate(instance, () => {
        });
      }
    }
  };
  return [instance.hooks[index], setState];
}
function useEffect(effect, deps) {
  const instance = assertInstance();
  const index = instance.hookIndex++;
  const record = instance.hooks[index] || { deps: void 0, cleanup: void 0 };
  const hasDeps = Array.isArray(deps);
  const prevDeps = record.deps;
  const changed = !hasDeps || !prevDeps || deps.length !== prevDeps.length || deps.some((dep, i) => !Object.is(dep, prevDeps[i]));
  if (changed) {
    instance.effects.push(() => {
      if (typeof record.cleanup === "function") {
        record.cleanup();
      }
      const cleanup = effect();
      instance.hooks[index] = {
        deps,
        cleanup: typeof cleanup === "function" ? cleanup : void 0
      };
    });
  } else {
    instance.effects.push(() => {
      instance.hooks[index] = record;
    });
  }
}

// src/runtime/suspense.gbln
function isPromise(value) {
  return Boolean(value) && typeof value.then === "function";
}
async function resolveVNode(candidate) {
  if (candidate == null) {
    return null;
  }
  if (typeof candidate === "function") {
    return resolveVNode(candidate());
  }
  if (isPromise(candidate)) {
    const resolved = await candidate;
    return resolveVNode(resolved);
  }
  if (Array.isArray(candidate)) {
    return h("goblin-fragment", null, ...candidate);
  }
  return candidate;
}
function renderFallback(fallback) {
  if (typeof fallback === "function") {
    return fallback() ?? null;
  }
  return fallback ?? null;
}
function Suspense(props) {
  const [state, setState] = useState({ status: "pending", vnode: null, error: null });
  useEffect(() => {
    let cancelled = false;
    setState({ status: "pending", vnode: null, error: null });
    resolveVNode(props.children).then((vnode) => {
      if (!cancelled) {
        setState({ status: "resolved", vnode: vnode ?? null, error: null });
      }
    }).catch((error) => {
      if (!cancelled) {
        setState({ status: "rejected", vnode: null, error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [props.children]);
  if (state.status === "resolved") {
    return state.vnode;
  }
  if (state.status === "rejected") {
    throw state.error ?? new Error("Suspense child rejected without an error reason.");
  }
  return renderFallback(props.fallback);
}
function defaultKeyResolver(params) {
  if (params == null) {
    return "__default__";
  }
  if (typeof params === "string" || typeof params === "number" || typeof params === "boolean") {
    return params;
  }
  try {
    return JSON.stringify(params);
  } catch (_error) {
    return params;
  }
}
function createResource(loader, options = {}) {
  const cache = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  const key = options.key ?? defaultKeyResolver;
  function notify(entryKey) {
    const set = listeners.get(entryKey);
    if (!set) return;
    for (const listener of set) {
      listener();
    }
  }
  function load(entryKey, params) {
    const existing = cache.get(entryKey);
    if (existing && existing.status === "pending") {
      return existing;
    }
    const record = { status: "pending" };
    const promise = Promise.resolve(loader(params));
    record.promise = promise;
    cache.set(entryKey, record);
    promise.then((value) => {
      record.status = "resolved";
      record.value = value;
      notify(entryKey);
    }).catch((error) => {
      record.status = "rejected";
      record.error = error;
      notify(entryKey);
    });
    return record;
  }
  function ensure(params) {
    const entryKey = key(params);
    const record = cache.get(entryKey) ?? load(entryKey, params);
    return { entryKey, record };
  }
  return {
    read(params) {
      const { record } = ensure(params);
      if (record.status === "resolved") {
        return record.value;
      }
      if (record.status === "rejected") {
        throw record.error;
      }
      throw record.promise;
    },
    preload(params) {
      const { record } = ensure(params);
      if (record.status === "resolved") {
        return Promise.resolve(record.value);
      }
      if (record.status === "rejected") {
        return Promise.reject(record.error);
      }
      return record.promise;
    },
    subscribe(params, listener) {
      const { entryKey } = ensure(params);
      let set = listeners.get(entryKey);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        listeners.set(entryKey, set);
      }
      set.add(listener);
      return () => {
        const target = listeners.get(entryKey);
        if (!target) return;
        target.delete(listener);
        if (target.size === 0) {
          listeners.delete(entryKey);
        }
      };
    },
    invalidate(params) {
      const entryKey = key(params);
      cache.delete(entryKey);
      notify(entryKey);
    },
    clear() {
      cache.clear();
      listeners.clear();
    },
    keyFor(params) {
      return key(params);
    }
  };
}

// src/index.gbln
var featureResource = createResource(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  return ["fast", "typed", "suspense-ready"];
});
function App(props) {
  const hasStaticFeatures = Array.isArray(props.features) && props.features.length > 0;
  const staticItems = (props.features ?? []).map((label) => h("li", { class: "feature-item" }, label));
  return h(
    "main",
    { class: "goblin-app-shell" },
    h("h1", null, props.title),
    hasStaticFeatures ? h("ul", { class: "feature-list" }, staticItems) : h(
      Suspense,
      {
        fallback: () => h("p", { class: "loading" }, "Loading features...")
      },
      () => featureResource.preload(void 0).then((features) => {
        const items = features.map((label) => h("li", { class: "feature-item" }, label));
        return items.length > 0 ? h("ul", { class: "feature-list" }, items) : h("p", null, "Configure features in src/index.gbln to see them here.");
      })
    )
  );
}

// src/server/streaming.gbln
var DEFAULT_CHUNK_SIZE = 1024;
async function* renderVNodeToStream(vnode, options = {}) {
  const chunkSize = Math.max(16, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const serialized = JSON.stringify(vnode);
  for (let index = 0; index < serialized.length; index += chunkSize) {
    if (options.signal?.aborted) {
      break;
    }
    const chunk = serialized.slice(index, index + chunkSize);
    yield chunk;
    if (chunkSize > 64) {
      await Promise.resolve();
    }
  }
}

// src/server/index.gbln
async function renderToStream(props) {
  const vnode = App(props);
  return renderVNodeToStream(vnode);
}
function createServer(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3e3;
  const streaming = Boolean(options.streaming);
  const server = http.createServer(async (_req, res) => {
    const props = { title: "Goblin Server", features: ["ssr", "typed", "fast"] };
    if (streaming) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");
      try {
        for await (const chunk of await renderToStream(props)) {
          res.write(chunk);
        }
        res.end();
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    const vnode = App(props);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(vnode));
  });
  return {
    listen(cb) {
      server.listen(port, host, cb);
    },
    close(cb) {
      server.close(cb);
    }
  };
}
async function renderToString(props) {
  const vnode = App(props);
  return JSON.stringify(vnode, null, 2);
}
export {
  createServer,
  renderToStream,
  renderToString
};
//# sourceMappingURL=index.js.map
