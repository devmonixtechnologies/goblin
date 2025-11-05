if (typeof window !== 'undefined') {window.__goblinEventSource = window.__goblinEventSource || (function(){try{const source=new EventSource('/__goblin_events');source.addEventListener('message',function(event){try{const payload=JSON.parse(event.data);if(payload.type==='reload'){window.location.reload();}}catch(error){console.error('[goblin] failed to parse HMR message',error);}});return source;}catch(error){console.warn('[goblin] unable to establish HMR channel', error);}return null;})();}

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

// src/index.gbln
function App(props) {
  const featureItems = (props.features ?? []).map((label) => h("li", { class: "feature-item" }, label));
  return h(
    "main",
    { class: "goblin-app-shell" },
    h("h1", null, props.title),
    featureItems.length > 0 ? h("ul", { class: "feature-list" }, featureItems) : h("p", null, "Configure features in src/index.gbln to see them here.")
  );
}
function createRoot() {
  return {
    render(target, props) {
      const vnode = App(props);
      target.dispatchEvent(new CustomEvent("goblin:render", { detail: { vnode } }));
      target.textContent = JSON.stringify(vnode, null, 2);
      return vnode;
    }
  };
}
var src_default = App;

export {
  App,
  createRoot,
  src_default
};
//# sourceMappingURL=chunk-LR6B7Y3B.js.map
