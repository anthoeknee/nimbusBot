// src/types/service.ts

export interface Service {
  name: string;
  initialize?: () => Promise<void> | void;
  [key: string]: any;
}
