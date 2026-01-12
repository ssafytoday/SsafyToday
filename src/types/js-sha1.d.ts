declare module 'js-sha1' {
  function sha1(message: string | ArrayBuffer | Uint8Array): string;
  namespace sha1 {
    function hex(message: string | ArrayBuffer | Uint8Array): string;
    function array(message: string | ArrayBuffer | Uint8Array): number[];
    function digest(message: string | ArrayBuffer | Uint8Array): number[];
    function arrayBuffer(message: string | ArrayBuffer | Uint8Array): ArrayBuffer;
    function create(): {
      update(message: string | ArrayBuffer | Uint8Array): void;
      hex(): string;
      array(): number[];
      digest(): number[];
      arrayBuffer(): ArrayBuffer;
    };
    function update(message: string | ArrayBuffer | Uint8Array): void;
  }
  export = sha1;
}
