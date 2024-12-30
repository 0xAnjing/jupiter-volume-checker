import { Keypair } from "@solana/web3.js";
import "jsr:@std/dotenv/load";
import {
	DuneClient,
	QueryParameter,
	RunQueryArgs,
} from "@duneanalytics/client-sdk";

const dune = new DuneClient(Deno.env.get("DUNE_API_KEY") ?? "");

if (!Deno.env.get("DUNE_API_KEY")) {
	console.error("DUNE_API_KEY not found in .env file");
	Deno.exit(1);
}

const queryId = 4491781;

async function main() {
	const files: string[] = await getFiles();
	let publicAddresses: string[] = [];

	publicAddresses = getPublicKeys(files);
	if (publicAddresses.length === 0) {
		console.log("No wallets found in the wallets directory");
		return;
	}

	// Remove duplicate wallets
	publicAddresses = publicAddresses.filter(
		(address, index, self) =>
			self.findIndex((addr) => addr === address) === index
	);

	console.log(
		"Calculating swap volumes for " + publicAddresses.length + " wallets"
	);
	calculateSwapVolumes(publicAddresses.join(","));
}

async function getFiles() {
	const files: string[] = [];

	for await (const dirEntry of Deno.readDir("./wallets")) {
		if (dirEntry.name.endsWith(".json") || dirEntry.name.endsWith(".txt")) {
			files.push(dirEntry.name);
		}
	}

	return files;
}

function getPublicKeys(files: string[]): string[] {
	const publicKeys: string[] = [];

	for (const filename of files) {
		if (filename.endsWith(".json")) {
			const decodedKey = new Uint8Array(
				JSON.parse(Deno.readTextFileSync("./wallets/" + filename))
			);
			const wallet = Keypair.fromSecretKey(decodedKey);
			publicKeys.push(wallet.publicKey.toString());
		}

		if (filename.endsWith(".txt")) {
			const content = Deno.readTextFileSync("./wallets/" + filename);
			const wallets = content.split("\n");

			wallets.forEach((wallet) => {
				publicKeys.push(wallet);
			});
		}
	}

	return publicKeys;
}

function calculateSwapVolumes(wallets: string) {
	const params: QueryParameter[] = [];
	params.push(QueryParameter.enum("addresses", wallets));

	const opts: RunQueryArgs = {
		queryId,
		query_parameters: params,
	};

	dune
		.runQuery(opts)
		.then((executionResults) => {
			const data = executionResults.result?.rows;
			if (data) {
				const swapVolumes = parseResults(data);
				Deno.writeTextFile("./output/result.json", JSON.stringify(swapVolumes));
				console.log("Results saved to output/result.json");
			} else {
				console.error("No data returned from query");
			}
		})
		.catch((error) => console.error(error));
}

function parseResults(results: Record<string, unknown>[]) {
	const swapVolumes: { [key: string]: number } = {
		total_volume_usd: results[0]["total_volume_usd"] as number,
	};

	(results as Record<string, unknown>[]).forEach((result) => {
		const address = result["wallet"] as string;
		const volume = result["wallet_volume_usd"] as number;

		if (swapVolumes[address]) {
			swapVolumes[address] += volume;
		} else {
			swapVolumes[address] = volume;
		}
	});

	console.log("🚀 ~ parseResults ~ swapVolumes:", swapVolumes);
	return swapVolumes;
}

main();
