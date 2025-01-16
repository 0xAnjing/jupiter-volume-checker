import { Keypair } from "@solana/web3.js";
import "jsr:@std/dotenv/load";
import {
	DuneClient,
	QueryParameter,
	RunQueryArgs,
} from "@duneanalytics/client-sdk";
import select from "@inquirer/select";

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

	const answer = await select({
		message: "Select $JUP check",
		choices: [
			{
				name: "JUP API",
				value: "api",
				description: "Check using official Jup website https://jupuary.jup.ag/",
			},
			{
				name: "Dune Analytics",
				value: "dune",
				description:
					"Check using Dune Analytics https://dune.com/0xanjing/jupuary2024snapshot. Not accurate",
			},
		],
	});

	switch (answer) {
		case "api":
			calculateSwapVolumesUsingJupiter(publicAddresses);
			break;
		case "dune":
			calculateSwapVolumes(publicAddresses.join(","));
			break;
	}
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
	const swapVolumes: {
		[key: string]:
			| number
			| { volume_usd: number; estimated_jup_airdrop: number };
	} = {
		total_volume_usd: results[0]["total_volume_usd"] as number,
		total_estimated_jup: results[0]["total_estimated_jup_airdrop"] as number,
	};

	(results as Record<string, unknown>[]).forEach((result) => {
		const address = result["wallet"] as string;
		const volume = result["wallet_volume_usd"] as number;
		const jupiter = result["estimated_jup_airdrop"] as number;

		swapVolumes[address] = {
			volume_usd: volume,
			estimated_jup_airdrop: jupiter,
		};
	});

	console.log("🚀 ~ parseResults ~ swapVolumes:", swapVolumes);
	return swapVolumes;
}

async function calculateSwapVolumesUsingJupiter(wallets: string[]) {
	let total_jup = 0;
	let total_volume = 0;
	const results: {
		[key: string]: number | { error?: string };
	} = { total_estimated_jup: 0, total_volume_usd: 0 };

	for (const wallet of wallets) {
		const res = await fetch(
			`https://jupuary.jup.ag/api/allocation?wallet=${wallet}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					referer: `https://jupuary.jup.ag/allocation/${wallet}`,
				},
			}
		);

		const data = await res.json();

		if (!data.data) {
			results[wallet] = {
				error: "No data found",
			};
		}

		if (data.data) {
			results[wallet] = data.data;
		}

		total_jup += data.data?.total_allocated ?? 0;
		total_volume += data.data?.swap_score ?? 0;

		results["total_estimated_jup"] = total_jup;
		results["total_volume_usd"] = total_volume;
	}

	Deno.writeTextFile("./output/resultJupApi.json", JSON.stringify(results));
	console.log("Results saved to output/resultJupApi.json");
}

main();
