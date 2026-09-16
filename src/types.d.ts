// TODO Temporary disable of `any` rule until everything is typed here.
/* eslint-disable @typescript-eslint/no-explicit-any */

interface ITagoIO {
  ready: () => void;
  onStart: (callbackFn: (widget: any) => void) => void;
  onRealtime: (callbackFn: (data: any) => void) => void;
  sendData: (payload: any, callbackFn: (response: any) => void) => void;
}

export declare global {
  interface Window {
    TagoIO: ITagoIO;
  }
}

export interface TagoData {
  result: {
    variable: string;
    value?: string; //number | string | boolean
    group?: string;
    unit?: string;
    time: string;
    /**
     * id device
     */
    group?: string;
    metadata?: {
      [key: string]: string | number;
    };
  }[];
}
