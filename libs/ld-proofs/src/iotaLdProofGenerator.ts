import { IotaAnchoringChannel, IAnchoringResult } from "@tangle-js/anchors";

import { IotaSigner } from "./iotaSigner";
import { IIotaLinkedDataProof } from "./models/IIotaLinkedDataProof";
import { IJsonDocument } from "./models/IJsonDocument";
import { ILdProofOptions } from "./models/ILdProofOptions";
import { LinkedDataProofTypes } from "./models/linkedDataProofTypes";

export class IotaLdProofGenerator {
    private readonly anchoringChannel: IotaAnchoringChannel;

    private readonly signer: IotaSigner;

    private constructor(anchoringChannel: IotaAnchoringChannel, signer: IotaSigner) {
        this.anchoringChannel = anchoringChannel;
        this.signer = signer;
    }

    /**
     * Creates a new instance of LD Proof Generator
     *
     * @param anchoringChannel The anchoring channel to be used
     * @param signer The signer to be used
     * @returns The LD Proof generator
     */
    public static create(anchoringChannel: IotaAnchoringChannel, signer: IotaSigner): IotaLdProofGenerator {
        return new IotaLdProofGenerator(anchoringChannel, signer);
    }

    /**
     * Generates a Linked Data Proof for a JSON(-LD) document by anchoring it to the anchorage provided
     *
     * @param doc Document
     * @param options containing the parameters to be used to generate the proof
     *
     * @returns Linked Data Proof
     *
     */
    public async generate(doc: string | IJsonDocument, options: ILdProofOptions): Promise<IIotaLinkedDataProof> {
        const linkedDataSignature = await this.signer.signJson(doc, options);

        // Now we take the Linked Data Signature and anchor it to Tangle through the Channel
        const anchoringResult = await this.anchoringChannel.anchor(
            Buffer.from(JSON.stringify(linkedDataSignature)),
            options.anchorageID
        );

        return this.buildLdProof(anchoringResult);
    }

    /**
     * Generates a chain of Linked Data Proofs for the JSON(-LD) documents passed as parameter
     *
     * @param docs The chain of documents
     * @param options the Parameters to be used when generating the chain of proofs
     *
     * @returns the list of Linked Data Proof
     */
    public async generateChain(docs: string[] | IJsonDocument[],
        options: ILdProofOptions): Promise<IIotaLinkedDataProof[]> {
        const result: IIotaLinkedDataProof[] = [];

        const proofOptions: ILdProofOptions = {
            ...options
        };

        for (const doc of docs) {
            const ldProof = await this.generate(doc, proofOptions);
            result.push(ldProof);
            // The next anchorage is the proof Message ID
            proofOptions.anchorageID = ldProof.proofValue.msgID;
        }

        return result;
    }

    private buildLdProof(anchoringResult: IAnchoringResult): IIotaLinkedDataProof {
        const linkedDataProof: IIotaLinkedDataProof = {
            type: LinkedDataProofTypes.IOTA_LD_PROOF_2021,
            // This has to be made more accurate pointing to the public key used to send data to the channel
            verificationMethod: this.signer.did,
            proofPurpose: "dataVerification",
            proofValue: {
                channelID: this.anchoringChannel.channelID,
                anchorageID: anchoringResult.anchorageID,
                msgID: anchoringResult.msgID
            },
            created: new Date().toISOString()
        };

        return linkedDataProof;
    }
}
