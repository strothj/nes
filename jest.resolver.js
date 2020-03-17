// Jest resolver which maps the .js file extensions to their real TypeScript
// source files.
const fs = require("fs");
const path = require("path");

module.exports = (request, options) => {
  const basedir = path.join(__dirname, "src");
  if (!options.basedir.includes(basedir) || !/\.js$/.test(request)) {
    return options.defaultResolver(request, options);
  }

  for (const extension of [".ts", ".tsx"]) {
    const nextRequest = request.replace(/\.js$/, extension);
    if (!fs.existsSync(path.join(options.basedir, nextRequest))) {
      continue;
    }
    return options.defaultResolver(nextRequest, options);
  }
  return options.defaultResolver(request, options);
};
