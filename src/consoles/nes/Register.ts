export class Register<T extends Uint8Array | Uint16Array> {
  private readonly typedArray: T;

  constructor(
    TypedArrayConstructor: new (length: number) => T,
    initialValue?: number,
  ) {
    this.typedArray = new TypedArrayConstructor(1);
    this.typedArray[0] = initialValue ?? 0;
  }

  get value(): number {
    return this.typedArray[0];
  }

  set value(value: number) {
    this.typedArray[0] = value;
  }

  increment(delta: number): void {
    this.typedArray[0] += delta;
  }
}
