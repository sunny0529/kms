import { encode } from "bs58";
import nacl from "tweetnacl";
import { derivePath } from "near-hd-key";
import { BIP44 } from "../../types";

export class KEYSTORE {
  static getAccount(seed: string, path: BIP44): string {
    const { key } = derivePath(
      `m/44'/${path.type}'/${path.account}'/0'/${path.index}'`,
      seed
    );
    const keyPair = nacl.sign.keyPair.fromSeed(key);
    return encode(Buffer.from(keyPair.publicKey));
  }
  /*
  static signTx(node: BIP32Interface, rawTx: RawTx): { [key: string]: any } {
    // ...
  }
  */

  /*
  export signMessage(node: BIP32Interface, msg: string) {
    // ...
  }
  */
}
