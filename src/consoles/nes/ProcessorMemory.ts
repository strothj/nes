import { ProcessorStatusFlag } from "./ProcessorStatusFlag.js";
import { Register } from "./Register.js";
import { Utils } from "./Utils.js";

export class ProcessorMemory {
  readonly programCounter = new Register(Uint16Array);
  readonly stackPointer = new Register(Uint8Array, 0xff);
  readonly accumulator = new Register(Uint8Array);
  readonly indexRegisterX = new Register(Uint8Array);
  readonly indexRegisterY = new Register(Uint8Array);
  readonly flags: Record<ProcessorStatusFlag, boolean> = {
    carry: false,
    zero: false,
    interruptDisable: false,
    decimalMode: false,
    breakCommand: false,
    overflow: false,
    negative: false,
  };
  private readonly memory = new Uint8Array(0x10000);

  constructor(memoryArrayBuffer: ArrayBuffer) {
    if (memoryArrayBuffer.byteLength > this.memory.byteLength) {
      throw new Error("Initial memory content length exceeds platform limit.");
    }
    this.memory.set(new Uint8Array(memoryArrayBuffer));
  }

  getByte(address: number): number {
    // Zero the first 16 bits to implement wrap around and prevent out of bounds
    // index access.
    return this.memory[address & 0x0000ffff];
  }

  setByte(address: number, value: number): void {
    // Zero the first 16 bits to implement wrap around and prevent out of bounds
    // index access.
    this.memory[address & 0x0000ffff] = value;
  }

  getSignedByte(address: number): number {
    const value = this.getByte(address);
    return Utils.unsignedToSigned(value, 8);
  }

  getU16(address: number): number {
    const lsb = this.getByte(address);
    const msb = this.getByte(address + 1);
    const value = lsb | (msb << 8);
    return value;
  }
}
