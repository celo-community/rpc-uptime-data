export type BlockNumberResponse = {
	statusCode: number;
	blockNumber?: number;
	responseTime?: number;
};

export type IsSyncingResponse = {
	statusCode: number;
	isSyncing?: boolean;
	responseTime?: number;
};

// {
//     "address": "0xe666f512a64a80Cc9b9ee5ad004b8074eEBF11Fb",
//     "name": "Textile",
//     "commission": "1",
//     "members": "5"
//   }

export interface IValidatorGroup {
	address: string;
	name: string;
	commission: string;
	members: string;
}

export interface IRPCInfo {
	validatorGroupName?: string;
	rpcUrl: string;
	validatorAddress: string;
}

// {
//     "address": "0x54D0D2E0F1cC1D7fb21e2350F14d79A1237605D1",
//     "name": "Stakely.io",
//     "affiliation": "0xe92B7BA8497486e94bb59C51F595b590c4a5f894",
//     "score": "0.9999997114312",
//     "ecdsaPublicKey": "0x5eafbc3d6801f87eabf2ecdace51da8a9bda82fcb76efb542e72922288604a4dd21a2e462918e3847e779a574df7140ebd3eb65b2ed374118a0076ead6e82a00",
//     "blsPublicKey": "0x90a94fc33f6587ed8646b5fc7130157618a64051dcd4c26d7d8f011187d3e32fb0f919070ee00465da425f544f4aa6016332dbe981cf1d693af3058e1939bb38e4a40bf7d193d0db22f4f0a380b2f24c38c05b0956c9f62d742f97c2cff58601",
//     "signer": "0x003CfdB7813f8e7A76329dDF185ebF4f3f9058Da"
//   },

export interface IElectedValidator {
	address: string;
	name: string;
	affiliation: string;
	score: string;
	ecdsaPublicKey: string;
	blsPublicKey: string;
	signer: string;
}
