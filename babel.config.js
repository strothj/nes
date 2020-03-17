module.exports = api => {
  const presetEnvOptions = {
    modules: false,
    useBuiltIns: "usage",
    corejs: 3
  };

  if (api.env("test")) {
    targets = "node 12";
    presetEnvOptions.modules = "commonjs";
  }

  return {
    presets: [
      ["@babel/preset-env", presetEnvOptions],
      "@babel/preset-typescript"
    ]
  };
};
