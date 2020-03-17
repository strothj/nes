// A Jest transform which which returns a binary file as an ArrayBuffer.
// @ts-check
const fs = require("fs");

module.exports = {
  /**
   * @param {string} _src
   * @param {string} filename
   */
  process(_src, filename) {
    const buffer = fs.readFileSync(filename);
    const byteArray = /** @type {number[]} */ ([]);
    for (const byte of buffer.values()) {
      byteArray.push(byte);
    }

    return `
      module.exports = new Uint8Array(${JSON.stringify(byteArray)}).buffer;
    `;
  },
};
