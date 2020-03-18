export class Utils {
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
}
