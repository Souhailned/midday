declare module 'react-grab' {
  export function init(): void;
  export const isInstrumentationActive: boolean;
}

declare module 'bippy/source' {
  export interface StackFrame {
    fileName: string;
    functionName: string;
    lineNumber: number;
    columnNumber: number;
  }
}
