declare module 'utif' {
  interface IFD {
    width: number;
    height: number;
    data: ArrayBuffer;
    [key: string]: any;
  }

  function decode(buffer: ArrayBuffer): IFD[];
  function decodeImage(buffer: ArrayBuffer, ifd: IFD): void;
  function toRGBA8(ifd: IFD): Uint8Array;
  
  export { decode, decodeImage, toRGBA8 };
}
