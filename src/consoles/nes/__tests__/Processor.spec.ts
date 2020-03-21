import functionalTestBin from "../__fixtures__/6502_functional_test.bin";
import { ProcessorMemory } from "../ProcessorMemory.js";
import { Processor } from "../Processor.js";

function logMemory(
  memory: ProcessorMemory,
  lastProgramCounter: number,
): string {
  const table: Record<string, number | boolean> = {
    "Program Counter": memory.programCounter.value,
    "Last Program Counter": lastProgramCounter,
    "Stack Pointer": memory.stackPointer.value,
    Accumulator: memory.accumulator.value,
    "Index Register X": memory.indexRegisterX.value,
    "Index Register Y": memory.indexRegisterY.value,
  };
  for (const [key, value] of Object.entries(memory.flags)) {
    table[`Processor Status Flag (${key})`] = value;
  }
  const formattedTable: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(table)) {
    formattedTable[key] =
      typeof value === "number"
        ? "0x" + value.toString(16).toUpperCase()
        : value;
  }
  formattedTable["Stack Contents"] = Array.from(
    {
      length: 0xff - memory.stackPointer.value,
    },
    (_, i) => memory.getByte(0x01ff - i).toString(16),
  ).join();
  return JSON.stringify(formattedTable, null, 2);
}

describe("Fixture", () => {
  it("6502_functional_test", () => {
    const memory = new ProcessorMemory(functionalTestBin);
    memory.programCounter.value = 0x0400;
    let lastProgramCounter = 0x000;
    const processor = new Processor(memory);
    const memoryLog: string[] = [];
    try {
      while (memory.programCounter.value !== lastProgramCounter) {
        lastProgramCounter = memory.programCounter.value;
        processor.executeInstruction();
        memoryLog.push(logMemory(memory, lastProgramCounter));
        if (memoryLog.length > 30) memoryLog.shift();
      }
    } catch (error) {
      console.log(...memoryLog);
      throw error;
    }
    if (memory.programCounter.value !== 0x3399) {
      console.log(...memoryLog.slice(0, -1));
      throw new Error("Infinite loop failure condition detected.");
    }
  });
});
