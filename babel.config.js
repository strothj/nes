// @ts-check
/**
 * @typedef PresetEnvOptions
 * @type {object}
 * @property {false | "commonjs"} modules
 * @property {"usage"} useBuiltIns
 * @property {3} corejs
 * @property {string=} targets
 */

/**
 * @param {{ env: (arg0: string) => object; }} api
 */
module.exports = (api) => {
  /** @type {PresetEnvOptions} */
  const presetEnvOptions = {
    modules: false,
    useBuiltIns: "usage",
    corejs: 3,
  };

  if (api.env("test")) {
    presetEnvOptions.targets = "node 12";
    presetEnvOptions.modules = "commonjs";
  }

  return {
    presets: [
      ["@babel/preset-env", presetEnvOptions],
      "@babel/preset-typescript",
    ],
    plugins: ["@babel/plugin-proposal-class-properties"],
  };
};
