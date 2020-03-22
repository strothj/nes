## Development Environment Workarounds

### Resolution Overrides (package.json)

- `@babel/core` overridden to minimum of `^7.9.0` due to Jest using a version of Babel without support for TypeScript's `import type` syntax.

### Jest

- A custom resolver was added to convert the `.js` imports in local TypeScript files to `.ts`. We import files using `.js` extensions because the compiled library will be loaded in the browser using a `module` type script tag.
- A custom transform was added to allow loading of binary rom files as ArrayBuffers.
