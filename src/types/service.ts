// src/types/service.ts

export type ModuleType = "single" | "multi" | "auto";

export interface Service {
  name: string;
  initialize?: () => Promise<void> | void;
  moduleType?: ModuleType;
  [key: string]: any;
}
