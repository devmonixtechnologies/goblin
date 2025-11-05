export interface GoblinTestCase {
  name: string;
  run: () => unknown | Promise<unknown>;
}

declare global {
  var describe: (name: string, fn: () => void) => void;
  var it: (name: string, fn: () => unknown | Promise<unknown>) => void;
  var expect: <T>(value: T) => {
    toBe: (expected: T) => void;
    toEqual: (expected: unknown) => void;
    toMatchInlineSnapshot: (snapshot: string) => void;
  };
}

export {};
