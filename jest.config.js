// @ts-check
module.exports = {
  resolver: "./jest.resolver.js",
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest",
    "\\.bin$": ["./jest.transform.bin.js"],
  },
};
