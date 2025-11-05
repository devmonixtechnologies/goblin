const queues = {
  immediate: [],
  normal: [],
  idle: []
};

let isFlushing = false;
let jobCounter = 0;
const pendingPostFlushCbs = [];

const nextTick = typeof queueMicrotask === 'function' ? queueMicrotask : cb => Promise.resolve().then(cb);

function scheduleFlush() {
  if (isFlushing) return;
  isFlushing = true;
  nextTick(runQueues);
}

function runQueues() {
  try {
    flushQueue('immediate');
    flushQueue('normal');
    if (!queues.immediate.length && !queues.normal.length) {
      flushQueue('idle');
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
  while ((entry = list.shift())) {
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

export function queueJob(job, priority = 'normal') {
  const list = queues[priority];
  if (!list.some(entry => entry.job === job)) {
    list.push({ job, id: jobCounter++ });
    scheduleFlush();
  }
}

export function withScheduler(fn, priority = 'normal') {
  return (...args) => queueJob(() => fn(...args), priority);
}

export function queuePostFlushCb(cb) {
  pendingPostFlushCbs.push(cb);
  scheduleFlush();
}

export function flushIdle() {
  flushQueue('idle');
}
