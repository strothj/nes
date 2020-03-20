import { PickByValue } from "utility-types";
import { ProcessorMemory } from "./ProcessorMemory.js";
import { ProcessorStatusFlag } from "./ProcessorStatusFlag.js";
import { Register } from "./Register.js";
import { Utils } from "./Utils.js";

export class Processor {
  constructor(private readonly memory: ProcessorMemory) {}

  private addIndexOffsetToAddress(
    baseAddress: number,
    indexOffset: number,
  ): number {
    const msb = baseAddress & 0x0000ff00;
    // Only the index offset wraps.
    const lsb = (baseAddress + indexOffset) & 0x000000ff;
    const address = msb | lsb;
    console.log({
      instruction: this.memory
        .getByte(this.memory.programCounter.value)
        .toString(16),
      baseAddress: baseAddress.toString(16),
      indexOffset: indexOffset.toString(16),
      msb: msb.toString(16),
      lsb: lsb.toString(16),
      address: address.toString(16),
    });
    return address;
  }

  private branchOnFlag(flag: ProcessorStatusFlag, flagValue: boolean): number {
    const programCounter = this.memory.programCounter.value;
    this.memory.programCounter.increment(2);
    if (this.memory.flags[flag] !== flagValue) return 2;

    const startingPage = (this.memory.programCounter.value & 0xff00) >>> 8;
    const operand = this.memory.getSignedByte(programCounter + 1);
    this.memory.programCounter.increment(operand);
    const endingPage = (this.memory.programCounter.value & 0xff00) >>> 8;
    return startingPage === endingPage ? 3 : 4;
  }

  private executeCompareValue(value: number, operand: number): void {
    this.memory.flags.carry = value >= operand;
    this.memory.flags.zero = value === operand;

    // The negative flag is set based on the subtraction of the operand from
    // the value. The most significant bit determines whether or not the
    // negative flag is set.
    // http://www.6502.org/tutorials/compare_beyond.html#2.1
    const result = value - operand;
    this.memory.flags.negative = (result & 0x80) > 0;
  }

  private compareValueImmediate(value: number): number {
    const programCounter = this.memory.programCounter.value;
    const operand = this.memory.getByte(programCounter + 1);
    this.executeCompareValue(value, operand);
    this.memory.programCounter.increment(2);
    return 2;
  }

  private compareValueAbsolute(value: number): number {
    const programCounter = this.memory.programCounter.value;
    const address = this.memory.getU16(programCounter + 1);
    const operand = this.memory.getByte(address);
    this.executeCompareValue(value, operand);
    this.memory.programCounter.increment(3);
    return 4;
  }

  private compareValueAbsoluteY(value: number): number {
    const programCounter = this.memory.programCounter.value;
    const startingPage = (programCounter & 0xff00) >>> 8;

    const baseAddress = this.memory.getU16(programCounter + 1);
    const address = this.addIndexOffsetToAddress(
      baseAddress,
      this.memory.indexRegisterY.value,
    );
    const operand = this.memory.getByte(address);
    this.executeCompareValue(value, operand);
    this.memory.programCounter.increment(3);

    const endingPage = (address & 0xff00) >>> 8;
    const pageCrossed = startingPage === endingPage;
    return pageCrossed ? 5 : 4;
  }

  private pushAddressToStack(address: number): void {
    this.memory.setByte(
      0x0100 + this.memory.stackPointer.value,
      (address & 0xff00) >>> 8,
    );
    this.memory.stackPointer.increment(-1);
    this.memory.setByte(
      0x0100 + this.memory.stackPointer.value,
      address & 0x00ff,
    );
    this.memory.stackPointer.increment(-1);
  }

  private popAddressFromStack(): number {
    this.memory.stackPointer.increment(1);
    let address = this.memory.getByte(0x0100 + this.memory.stackPointer.value);
    this.memory.stackPointer.increment(1);
    address |=
      this.memory.getByte(0x0100 + this.memory.stackPointer.value) << 8;
    return address;
  }

  private pushFlagsToStack(): void {
    let value = 0;
    value += this.memory.flags.carry ? 0x01 : 0;
    value += this.memory.flags.zero ? 0x02 : 0;
    value += this.memory.flags.interruptDisable ? 0x04 : 0;
    value += this.memory.flags.decimalMode ? 0x08 : 0;
    // PHP and BRK instructions set this bit when pushing to the stack.
    // Not set when pushed by an interrupt.
    value += 0x10;
    // Unused bit 5, always set when pushed to stack.
    value += 0x20;
    value += this.memory.flags.overflow ? 0x40 : 0;
    value += this.memory.flags.negative ? 0x80 : 0;
    this.memory.setByte(0x0100 + this.memory.stackPointer.value, value);
    this.memory.stackPointer.increment(-1);
  }

  private popAndSetFlagsFromStack(): void {
    this.memory.stackPointer.increment(1);
    const value = this.memory.getByte(0x0100 + this.memory.stackPointer.value);
    this.memory.flags.carry = (value & 0x01) === 0x01;
    this.memory.flags.zero = (value & 0x02) === 0x02;
    this.memory.flags.interruptDisable = (value & 0x04) === 0x04;
    this.memory.flags.decimalMode = (value & 0x08) === 0x08;
    this.memory.flags.breakCommand = (value & 0x10) === 0x10;
    this.memory.flags.overflow = (value & 0x40) === 0x40;
    this.memory.flags.negative = (value & 0x80) === 0x80;
  }

  private loadRegisterAbsoluteIndexed<T extends Uint16Array | Uint8Array>({
    targetRegisterName,
    indexRegisterName,
  }: {
    targetRegisterName: keyof PickByValue<ProcessorMemory, Register<T>>;
    indexRegisterName: keyof PickByValue<ProcessorMemory, Register<T>>;
  }): number {
    const programCounter = this.memory.programCounter.value;
    const baseAddress = this.memory.getU16(programCounter + 1);
    const address = this.addIndexOffsetToAddress(
      baseAddress,
      this.memory[indexRegisterName].value,
    );
    const startingPage = (Utils.u16Increment(programCounter, 2) & 0xff00) >>> 8;
    const endingPage = (address & 0xff00) >>> 8;
    const pageCrossed = startingPage !== endingPage;
    const registerValue = this.memory.getByte(address);
    this.memory[targetRegisterName].value = registerValue;
    this.memory.flags.zero = registerValue === 0;
    this.memory.flags.negative = (registerValue & 0x80) === 0x80;
    this.memory.programCounter.increment(3);
    return pageCrossed ? 5 : 4;
  }

  executeInstruction(): number {
    const programCounter = this.memory.programCounter.value;
    const opCode = this.memory.getByte(programCounter);

    switch (opCode) {
      // BRK - Force Interrupt (Implied)
      case 0x00: {
        const address = this.memory.getU16(0xfffe);
        // You'd assume that because this is a single byte instruction, the
        // address that's pushed to the stack (as the return address) would be
        // the byte immediately after this instruction. Instead, it's the byte
        // after that (PC + 2).
        this.pushAddressToStack(this.memory.programCounter.value + 2);
        this.pushFlagsToStack();
        this.memory.programCounter.value = address;
        this.memory.flags.interruptDisable = true;
        return 7;
      }

      // PHP - Push Processor Status (Implied)
      case 0x08: {
        this.pushFlagsToStack();
        this.memory.programCounter.increment(1);
        return 3;
      }

      // BPL - Branch if Positive (Relative)
      case 0x10: {
        return this.branchOnFlag("negative", false);
      }

      // CLC - Clear Carry Flag (Implied)
      case 0x18: {
        this.memory.flags.carry = false;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // JSR - Jump to Subroutine (Absolute)
      case 0x20: {
        const address = this.memory.getU16(programCounter + 1);
        this.memory.programCounter.increment(2);
        this.pushAddressToStack(this.memory.programCounter.value);
        this.memory.programCounter.value = address;
        return 6;
      }

      // PLP - Pull Processor Status (Implied)
      case 0x28: {
        this.popAndSetFlagsFromStack();
        this.memory.programCounter.increment(1);
        return 4;
      }

      // BMI - Branch if Minus (Relative)
      case 0x30: {
        return this.branchOnFlag("negative", true);
      }

      // SEC - Set Carry Flag (Implied)
      case 0x38: {
        this.memory.flags.carry = true;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // RTI - Return from Interrupt (Implied)
      case 0x40: {
        this.popAndSetFlagsFromStack();
        const address = this.popAddressFromStack();
        this.memory.programCounter.value = address;
        return 6;
      }

      // PHA - Push Accumulator (Implied)
      case 0x48: {
        this.memory.setByte(
          0x0100 + this.memory.stackPointer.value,
          this.memory.accumulator.value,
        );
        this.memory.stackPointer.increment(-1);
        this.memory.programCounter.increment(1);
        return 3;
      }

      // EOR - Exclusive OR (Immediate)
      case 0x49: {
        const operand = this.memory.getByte(programCounter + 1);
        const accumulator = this.memory.accumulator.value ^ operand;
        this.memory.accumulator.value = accumulator;
        this.memory.flags.zero = accumulator === 0;
        this.memory.flags.negative = (accumulator & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // JMP - Jump (Absolute)
      case 0x4c: {
        const address = this.memory.getU16(programCounter + 1);
        this.memory.programCounter.value = address;
        return 3;
      }

      // BVC - Branch if Overflow Clear (Relative)
      case 0x50: {
        return this.branchOnFlag("overflow", false);
      }

      // CLI - Clear Interrupt Disable (Implied)
      case 0x58: {
        this.memory.flags.interruptDisable = false;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // RTS - Return from Subroutine (Implied)
      case 0x60: {
        const address = this.popAddressFromStack();
        this.memory.programCounter.value = address + 1;
        return 6;
      }

      // PLA - Pull Accumulator (Implied)
      case 0x68: {
        // Decrement stack pointer first to deal with wrap around. The stack
        // pointer points to the next available slot, not the current slot.
        this.memory.stackPointer.increment(1);
        const accumulator = this.memory.getByte(
          0x0100 + this.memory.stackPointer.value,
        );
        this.memory.accumulator.value = accumulator;
        this.memory.flags.zero = accumulator === 0;
        this.memory.flags.negative = (accumulator & 0x80) === 0x80;
        this.memory.programCounter.increment(1);
        return 4;
      }

      // ADC - Add with Carry (Immediate)
      case 0x69: {
        const operand = this.memory.getByte(programCounter + 1);
        const carry = this.memory.flags.carry ? 1 : 0;
        const accumulator = this.memory.accumulator.value + carry;
        const value = accumulator + operand;
        this.memory.accumulator.value = value;
        this.memory.flags.carry = value > 255;
        this.memory.flags.zero = value === 0;

        const positiveOperand = Utils.unsignedToSigned(operand, 8) >= 0;
        const positiveAccumulator = Utils.unsignedToSigned(accumulator, 8) >= 0;
        const positiveValue = Utils.unsignedToSigned(value, 8) >= 0;
        if (
          positiveOperand === positiveAccumulator &&
          positiveOperand !== positiveValue
        ) {
          this.memory.flags.overflow = true;
        }

        this.memory.programCounter.increment(2);
        return 2;
      }

      // JMP - Jump (Indirect)
      case 0x6c: {
        const pointer = this.memory.getU16(programCounter + 1);
        const address = this.memory.getU16(pointer);
        this.memory.programCounter.value = address;
        return 5;
      }

      // BVS - Branch if Overflow Set (Relative)
      case 0x70: {
        return this.branchOnFlag("overflow", true);
      }

      // SEI - Set Interrupt Disable (Implied)
      case 0x78: {
        this.memory.flags.interruptDisable = true;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // STA - Store Accumulator (Zero Page)
      case 0x85: {
        const address = this.memory.getByte(programCounter + 1);
        this.memory.setByte(address, this.memory.accumulator.value);
        this.memory.programCounter.increment(2);
        return 3;
      }

      // STX - Store X Register (Zero Page)
      case 0x86: {
        const address = this.memory.getByte(programCounter + 1);
        this.memory.setByte(address, this.memory.indexRegisterX.value);
        this.memory.programCounter.increment(2);
        return 3;
      }

      // DEY - Decrement Y Register (Implied)
      case 0x88: {
        this.memory.indexRegisterY.increment(-1);
        this.memory.flags.zero = this.memory.indexRegisterY.value === 0;
        this.memory.flags.negative =
          (this.memory.indexRegisterY.value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // TXA - Transfer X to Accumulator (Implied)
      case 0x8a: {
        const accumulator = this.memory.indexRegisterX.value;
        this.memory.accumulator.value = accumulator;
        this.memory.flags.zero = accumulator === 0;
        this.memory.flags.negative = (accumulator & 0x80) === 0x80;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // STA - Store Accumulator (Absolute)
      case 0x8d: {
        const address = this.memory.getU16(programCounter + 1);
        this.memory.setByte(address, this.memory.accumulator.value);
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
        this.memory.flags.zero = this.memory.accumulator.value === 0;
        this.memory.flags.negative = (this.memory.accumulator.value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // STA - Store Accumulator (Absolute, Y)
      case 0x99: {
        const baseAddress = this.memory.getU16(programCounter + 1);
        const address = this.addIndexOffsetToAddress(
          baseAddress,
          this.memory.indexRegisterY.value,
        );
        this.memory.setByte(address, this.memory.accumulator.value);
        this.memory.programCounter.increment(3);
        return 5;
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
        this.memory.flags.zero = operand === 0;
        this.memory.flags.negative = (operand & 0x80) === 0x80;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // LDX - Load X Register (Immediate)
      case 0xa2: {
        const operand = this.memory.getByte(programCounter + 1);
        this.memory.indexRegisterX.value = operand;
        this.memory.flags.zero = operand === 0;
        this.memory.flags.negative = (operand & 0x80) === 0x80;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // LDA - Load Accumulator (Zero Page)
      case 0xa5: {
        const address = this.memory.getByte(programCounter + 1);
        const operand = this.memory.getByte(address);
        this.memory.accumulator.value = operand;
        this.memory.flags.zero = operand === 0;
        this.memory.flags.negative = (operand & 0x80) === 0x80;
        this.memory.programCounter.increment(2);
        return 3;
      }

      // LDX - Load X Register (Zero Page)
      case 0xa6: {
        const address = this.memory.getByte(programCounter + 1);
        const operand = this.memory.getByte(address);
        this.memory.indexRegisterX.value = operand;
        this.memory.flags.zero = operand === 0;
        this.memory.flags.negative = (operand & 0x80) === 0x80;
        this.memory.programCounter.increment(2);
        return 3;
      }

      // TAY - Transfer Accumulator to Y (Implied)
      case 0xa8: {
        const y = this.memory.accumulator.value;
        this.memory.indexRegisterY.value = y;
        this.memory.flags.zero = y === 0;
        this.memory.flags.negative = (y & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // LDA - Load Accumulator (Immediate)
      case 0xa9: {
        const operand = this.memory.getByte(programCounter + 1);
        const accumulator = operand;
        this.memory.accumulator.value = accumulator;
        this.memory.flags.zero = accumulator === 0;
        this.memory.flags.negative = (accumulator & 0x80) === 0x80;
        this.memory.programCounter.increment(2);
        return 2;
      }

      // TAX - Transfer Accumulator to X
      case 0xaa: {
        const value = this.memory.accumulator.value;
        this.memory.indexRegisterX.value = value;
        this.memory.flags.zero = value === 0;
        this.memory.flags.negative = (value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // LDA - Load Accumulator (Absolute)
      case 0xad: {
        const address = this.memory.getU16(programCounter + 1);
        const value = this.memory.getByte(address);
        this.memory.accumulator.value = value;
        this.memory.flags.zero = value === 0;
        this.memory.flags.negative = (value & 0x80) > 0;
        this.memory.programCounter.increment(3);
        return 4;
      }

      // BCS - Branch if Carry Set (Relative)
      case 0xb0: {
        return this.branchOnFlag("carry", true);
      }

      // LDX - Load X Register (Zero Page, Y)
      case 0xb6: {
        const baseAddress = this.memory.getByte(programCounter + 1);
        const address = this.addIndexOffsetToAddress(
          baseAddress,
          this.memory.indexRegisterY.value,
        );
        const operand = this.memory.getByte(address);
        this.memory.indexRegisterX.value = operand;
        this.memory.flags.zero = operand === 0;
        this.memory.flags.negative = (operand & 0x80) > 0;
        this.memory.programCounter.increment(2);
        return 4;
      }

      // CLV - Clear Overflow Flag (Implied)
      case 0xb8: {
        this.memory.flags.overflow = false;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // TSX - Transfer Stack Pointer to X (Implied)
      case 0xba: {
        const x = this.memory.stackPointer.value;
        this.memory.indexRegisterX.value = x;
        this.memory.flags.zero = x === 0;
        this.memory.flags.negative = (x & 0x80) === 0x80;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // LDA - Load Accumulator (Absolute,X)
      case 0xbd: {
        return this.loadRegisterAbsoluteIndexed({
          targetRegisterName: "accumulator",
          indexRegisterName: "indexRegisterX",
        });
      }

      // LDX - Load X Register (Absolute, Y)
      case 0xbe: {
        return this.loadRegisterAbsoluteIndexed({
          targetRegisterName: "indexRegisterX",
          indexRegisterName: "indexRegisterY",
        });
      }

      // CPY - Compare Y Register (Immediate)
      case 0xc0: {
        return this.compareValueImmediate(this.memory.indexRegisterY.value);
      }

      // INY - Increment Y Register (Implied)
      case 0xc8: {
        this.memory.indexRegisterY.increment(1);
        const y = this.memory.indexRegisterY.value;
        this.memory.flags.zero = y === 0;
        this.memory.flags.negative = (y & 0x80) === 0x80;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // DEX - Decrement X Register (Implied)
      case 0xca: {
        const value = this.memory.indexRegisterX.value - 1;
        this.memory.indexRegisterX.value = value;
        this.memory.flags.zero = value === 0;
        this.memory.flags.negative = (value & 0x80) > 0;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // CMP - Compare (Immediate)
      case 0xc9: {
        return this.compareValueImmediate(this.memory.accumulator.value);
      }

      // CMP - Compare (Absolute)
      case 0xcd: {
        return this.compareValueAbsolute(this.memory.accumulator.value);
      }

      // BNE - Branch if Not Equal (Relative)
      case 0xd0: {
        return this.branchOnFlag("zero", false);
      }

      // CLD - Clear Decimal Mode (Implied)
      case 0xd8: {
        this.memory.flags.decimalMode = false;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // CMP - Compare (Absolute, Y)
      case 0xd9: {
        return this.compareValueAbsoluteY(this.memory.accumulator.value);
      }

      // CPX - Compare X Register (Immediate)
      case 0xe0: {
        return this.compareValueImmediate(this.memory.indexRegisterX.value);
      }

      // INX - Increment X Register (Implied)
      case 0xe8: {
        this.memory.indexRegisterX.increment(1);
        const x = this.memory.indexRegisterX.value;
        this.memory.flags.zero = x === 0;
        this.memory.flags.negative = (x & 0x80) === 0x80;
        this.memory.programCounter.increment(1);
        return 2;
      }

      // NOP - No Operation (Implied)
      case 0xea: {
        this.memory.programCounter.increment(1);
        return 2;
      }

      // BEQ - Branch if Equal (Relative)
      case 0xf0: {
        return this.branchOnFlag("zero", true);
      }

      // SED - Set Decimal Flag (Implied)
      case 0xf8: {
        this.memory.flags.decimalMode = true;
        this.memory.programCounter.increment(1);
        return 2;
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
