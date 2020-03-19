export class Utils {
  private static u16Array = new Uint16Array(1);

  /**
   * Converts the provided unsigned value to a signed one using twos-complement.
   *
   * @param unsignedValue Unsigned value to convert to signed.
   * @param bitLength The bit length of the value.
   * @see https://stackoverflow.com/a/60227348
   */
  static unsignedToSigned(unsignedValue: number, bitLength: number): number {
    const isNegative = unsignedValue & (1 << (bitLength - 1));
    if (isNegative) {
      const boundary = 1 << bitLength;
      const minimumValue = -boundary;
      const mask = boundary - 1;
      return minimumValue + (unsignedValue & mask);
    }
    return unsignedValue;
  }

  /**
   * Increments `value` by the provided `delta. Performs wrap around on
   * overflow.
   *
   * @param value Value to increment.
   * @param delta A positive or negative number to increment `value` by.
   */
  static u16Increment(value: number, delta: number): number {
    this.u16Array[0] = value + delta;
    return this.u16Array[0];
  }
}
