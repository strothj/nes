## Development Environment Workarounds

### Resolution Overrides (package.json)

- `@babel/core` overridden to minimum of `^7.9.0` due to Jest using a version of Babel without support for TypeScript's `import type` syntax.
- `prettier` overridden to use the `next` branch for TypeScript's `import type` syntax.

### Package Extensions (.yarnrc.yml)

- `@angular/compiler` is a dependency of Prettier's next branch. It causes a warning about the missing dependency `tslib`. This is not an Angular project so the dependency was overridden to be optional.

### Jest

- A custom resolver was added to convert the `.js` imports in local TypeScript files to `.ts`. We import files using `.js` extensions because the compiled library will be loaded in the browser using a `module` type script tag.
- A custom transform was added to allow loading of binary rom files as ArrayBuffers.
