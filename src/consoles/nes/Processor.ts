import { ProcessorMemory } from "./ProcessorMemory.js";
import { Utils } from "./Utils.js";
import { ProcessorStatusFlag } from "./ProcessorStatusFlag.js";

export class Processor {
  constructor(private readonly memory: ProcessorMemory) {}

  private branchOnFlag(flag: ProcessorStatusFlag, flagValue: boolean): number {
    const programCounter = this.memory.programCounter.value;
    this.memory.programCounter.increment(2);
    if (this.memory.statusFlags[flag] !== flagValue) return 2;

    const startingPage = (this.memory.programCounter.value & 0xff00) >>> 8;
    const operand = this.memory.getSignedByte(programCounter + 1);
    this.memory.programCounter.increment(operand);
    const endingPage = (this.memory.programCounter.value & 0xff00) >>> 8;
    return startingPage === endingPage ? 3 : 4;
  }

  executeInstruction(): number {
    const programCounter = this.memory.programCounter.value;
    const opCode = this.memory.getByte(programCounter);

    switch (opCode) {
      // BPL - Branch if Positive (Relative)
      case 0x10: {
        return this.branchOnFlag("negative", false);
      }

      // CLC - Clear Carry Flag (Implied)
      case 0x18: {
        this.memory.statusFlags.carry = false;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // EOR - Exclusive OR (Immediate)
      case 0x49: {
        const operand = this.memory.getByte(programCounter + 1);
        const accumulator = this.memory.accumulator.value ^ operand;
        this.memory.accumulator.value = accumulator;
        this.memory.statusFlags.zero = accumulator === 0;
        this.memory.statusFlags.negative = (accumulator & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // JMP - Jump (Absolute)
      case 0x4c: {
        const address = this.memory.getU16(programCounter + 1);
        this.memory.programCounter.value = address;
        return 3;
      }

      // ADC - Add with Carry (Immediate)
      case 0x69: {
        const operand = this.memory.getByte(programCounter + 1);
        const carry = this.memory.statusFlags.carry ? 1 : 0;
        const accumulator = this.memory.accumulator.value + carry;
        const value = accumulator + operand;
        this.memory.accumulator.value = value;
        this.memory.statusFlags.carry = value > 255;
        this.memory.statusFlags.zero = value === 0;

        const positiveOperand = Utils.unsignedToSigned(operand, 8) >= 0;
        const positiveAccumulator = Utils.unsignedToSigned(accumulator, 8) >= 0;
        const positiveValue = Utils.unsignedToSigned(value, 8) >= 0;
        if (
          positiveOperand === positiveAccumulator &&
          positiveOperand !== positiveValue
        ) {
          this.memory.statusFlags.overflow = true;
        }

        this.memory.programCounter.increment(2);
        return 2;
      }

      // DEY - Decrement Y Register (Implied)
      case 0x88: {
        this.memory.indexRegisterY.increment(-1);
        this.memory.statusFlags.zero = this.memory.indexRegisterY.value === 0;
        this.memory.statusFlags.negative =
          (this.memory.indexRegisterY.value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // STA - Store Accumulator (Absolute)
      case 0x8d: {
        const address = this.memory.getU16(programCounter + 1);
        this.memory.setU8(address, this.memory.accumulator.value);
        this.memory.programCounter.increment(3);
        return 4;
      }

      // BCC - Branch if Carry Clear (Relative)
      case 0x90: {
        return this.branchOnFlag("carry", false);
      }

      // TYA - Transfer Y to Accumulator (Implied)
      case 0x98: {
        this.memory.accumulator.value = this.memory.indexRegisterY.value;
        this.memory.statusFlags.zero = this.memory.accumulator.value === 0;
        this.memory.statusFlags.negative =
          (this.memory.accumulator.value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // TXS - Transfer X to Stack Pointer (Implied)
      case 0x9a: {
        this.memory.stackPointer.value = this.memory.indexRegisterX.value;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // LDY - Load Y Register (Immediate)
      case 0xa0: {
        const operand = this.memory.getByte(programCounter + 1);
        this.memory.indexRegisterY.value = operand;
        this.memory.statusFlags.zero = operand === 0;
        this.memory.statusFlags.negative = (operand & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // LDX - Load X Register (Immediate)
      case 0xa2: {
        const operand = this.memory.getByte(programCounter + 1);
        this.memory.indexRegisterX.value = operand;
        this.memory.statusFlags.zero = operand === 0;
        this.memory.statusFlags.negative = (operand & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // LDA - Load Accumulator (Immediate)
      case 0xa9: {
        const operand = this.memory.getByte(programCounter + 1);
        this.memory.accumulator.value = operand;
        this.memory.statusFlags.zero = operand === 0;
        this.memory.statusFlags.negative = (operand & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // TAX - Transfer Accumulator to X
      case 0xaa: {
        const value = this.memory.accumulator.value;
        this.memory.indexRegisterX.value = value;
        this.memory.statusFlags.zero = value === 0;
        this.memory.statusFlags.negative = (value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // LDA - Load Accumulator (Absolute)
      case 0xad: {
        const address = this.memory.getU16(programCounter + 1);
        const value = this.memory.getByte(address);
        this.memory.accumulator.value = value;
        this.memory.statusFlags.zero = value === 0;
        this.memory.statusFlags.negative = (value & 0x80) > 0;
        this.memory.programCounter.increment(3);
        return 4;
      }

      // CPY - Compare Y Register (Immediate)
      case 0xc0: {
        const operand = this.memory.getByte(programCounter + 1);
        const y = this.memory.indexRegisterY.value;
        this.memory.statusFlags.carry = y >= operand;
        this.memory.statusFlags.zero = y === operand;
        this.memory.statusFlags.negative = (operand & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // DEX - Decrement X Register (Implied)
      case 0xca: {
        const value = this.memory.indexRegisterX.value - 1;
        this.memory.indexRegisterX.value = value;
        this.memory.statusFlags.zero = value === 0;
        this.memory.statusFlags.negative = (value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // CMP - Compare (Immediate)
      case 0xc9: {
        const operand = this.memory.getByte(programCounter + 1);
        const accumulator = this.memory.accumulator.value;
        this.memory.statusFlags.carry = accumulator >= operand;
        this.memory.statusFlags.zero = accumulator === operand;
        this.memory.statusFlags.negative = (operand & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // BNE - Branch if Not Equal (Relative)
      case 0xd0: {
        return this.branchOnFlag("zero", false);
      }

      // CLD - Clear Decimal Mode (Implied)
      case 0xd8: {
        this.memory.statusFlags.decimalMode = false;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // BEQ - Branch if Equal (Relative)
      case 0xf0: {
        return this.branchOnFlag("zero", true);
      }

      default: {
        throw new Error(
          `Unsupported opcode: 0x${opCode
            .toString(16)
            .toUpperCase()}: address: 0x${programCounter
            .toString(16)
            .toUpperCase()}`,
        );
      }
    }
  }
}
