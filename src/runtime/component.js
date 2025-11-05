import { queueJob } from './scheduler.js';

let currentInstance = null;
let instanceUid = 0;

export function createComponentInstance(vnode, parent) {
  const appContext = vnode.appContext || (parent && parent.appContext) || { provides: Object.create(null) };

  const instance = {
    uid: instanceUid++,
    vnode,
    parent: parent || null,
    appContext,
    type: vnode.type,
    root: parent ? parent.root : null,
    next: null,
    subTree: null,
    update: null,
    isMounted: false,
    props: vnode.props || {},
    hooks: [],
    hookIndex: 0,
    effects: [],
    provides: parent ? Object.create(parent.provides) : Object.create(appContext.provides || null)
  };

  if (!instance.root) {
    instance.root = instance;
  }

  vnode.component = instance;

  return instance;
}

export function setupComponent(instance) {
  const Component = instance.type;
  if (typeof Component !== 'function') {
    throw new Error('Goblin only supports function components at this time.');
  }
  instance.render = Component;
}

export function prepareInstanceForRender(instance) {
  instance.hookIndex = 0;
  instance.effects = [];
}

export function setCurrentInstance(instance) {
  currentInstance = instance;
}

export function resetCurrentInstance() {
  currentInstance = null;
}

export function getCurrentInstance() {
  return currentInstance;
}

export function updateComponentProps(instance, nextVNode) {
  instance.props = nextVNode.props || {};
}

export function scheduleComponentUpdate(instance, updateFn) {
  instance.update = () => queueJob(updateFn);
  return instance.update;
}
