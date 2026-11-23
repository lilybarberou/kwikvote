// web-push 4 is an ES module: its exports can't be spied on. cron.js (CommonJS)
// gets a mutable copy of them through the require cache instead, call this
// before requiring cron.js and spy on the returned object.
export const installWebPushCopy = (require: NodeJS.Require) => {
  const path = require.resolve("web-push");
  const copy = { ...require("web-push") };
  require.cache[path] = {
    id: path,
    filename: path,
    loaded: true,
    exports: copy,
  } as NodeJS.Module;
  return copy;
};
