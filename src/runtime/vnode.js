const TEXT_TYPE = Symbol('GoblinText');

function normalizeChildren(children) {
  const flat = [];
  children.forEach(child => {
    if (Array.isArray(child)) {
      flat.push(...normalizeChildren(child));
    } else if (child == null || child === false || child === true) {
    } else if (typeof child === 'object') {
      flat.push(child);
    } else {
      flat.push(createTextVNode(String(child)));
    }
  });
  return flat;
}

export function h(type, props = null, ...children) {
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
    shapeFlag: typeof type === 'string' ? 1 : typeof type === 'function' ? 2 : 0
  };
}

export function createTextVNode(text) {
  return {
    type: TEXT_TYPE,
    props: null,
    key: null,
    el: null,
    children: text,
    shapeFlag: 0
  };
}

export function isTextVNode(vnode) {
  return vnode && vnode.type === TEXT_TYPE;
}
