import {
	Keypair,
	Connection,
	LAMPORTS_PER_SOL,
	PublicKey,
	sendAndConfirmTransaction,
	Transaction,
	ComputeBudgetProgram,
	TransactionInstruction,
	SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import bs58 from "bs58";
import { Buffer } from "buffer";
import "jsr:@std/dotenv/load";
import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	createAssociatedTokenAccountIdempotentInstruction,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

let connection = new Connection(Deno.env.get("CLUSTER_URL"));

// Pengu token mint address
let mint = new PublicKey("2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv");

// Pengu claim airdrop program id
let programId = new PublicKey("CUEB3rQGVrvCRTmyjLrPnsd6bBBsGbz1Sr49vxNLJkGR");

let payer = Keypair.fromSecretKey(
	new Uint8Array(bs58.decode(Deno.env.get("PAYER_PRIVATE_KEY")))
);

async function main() {
	const files: string[] = await getFiles();
	let keypairs: Keypair[] = [];

	for (const filename of files) {
		if (filename.endsWith(".txt")) {
			const wallets = await getWalletFromTxt(filename);

			if (wallets[0] === "" && wallets.length === 0) {
				console.log("No wallets found in " + filename);
				continue;
			}

			wallets.forEach((privKey) => {
				if (privKey === "") {
					return;
				}

				const decodedKey = bs58.decode(privKey);

				keypairs.push(Keypair.fromSecretKey(decodedKey));
			});
		}

		if (filename.endsWith(".json")) {
			if ((await getWalletFromJson(filename)) === "") {
				console.log("No wallets found in " + filename);
				continue;
			}

			const decodedKey = new Uint8Array(
				JSON.parse(await getWalletFromJson(filename))
			);

			keypairs.push(Keypair.fromSecretKey(decodedKey));
		}
	}

	if (keypairs.length === 0) {
		console.log("No wallets found in the wallets directory");
		return;
	}

	// Remove duplicate wallets
	keypairs = keypairs.filter(
		(keypair, index, self) =>
			self.findIndex(
				(kp) => kp.publicKey.toString() === keypair.publicKey.toString()
			) === index
	);

	// keypairs = await checkEligibility(keypairs); // skip check
	if (keypairs.length === 0) {
		console.log("No wallets are eligible for airdrop");
		return;
	}

	// required to sign transactions
	keypairs.push(payer);

	await claimAirdrop(keypairs)
		.then((signature) => {
			console.log("Airdrop claimed successfully with signature: ", signature);
		})
		.catch((err) => {
			console.log("Error claiming airdrop: ", err);
		});
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

async function getWalletFromTxt(filename: string) {
	const content = await Deno.readTextFile("./wallets/" + filename);
	return content.split("\n");
}

async function getWalletFromJson(filename: string) {
	return Deno.readTextFile("./wallets/" + filename);
}

async function checkEligibility(keypairs: Keypair[]): Promise<Keypair[]> {
	for (const keypair of keypairs) {
		// let resp = await fetch(
		// 	"https://api.clusters.xyz/v0.1/airdrops/pengu/eligibility/" +
		// 	keypair.publicKey.toString()
		// );

		let resp = await fetch(
			"https://api.clusters.xyz/v0.1/airdrops/pengu/eligibility",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(
					[keypair.publicKey.toString()]
				),
			}
		)

		const response = await resp.json();

		console.log("Checking for wallet: " + keypair.publicKey.toString());

		if (response.total === 0) {
			console.log("Wallet not eligible! Removing from list...");
			keypairs = keypairs.filter(
				(kp) => kp.publicKey.toString() !== keypair.publicKey.toString()
			);
		} else if (response.totalUnclaimed === 0) {
			console.log("Wallet already claimed! Removing from list...");
			keypairs = keypairs.filter(
				(kp) => kp.publicKey.toString() !== keypair.publicKey.toString()
			);
		}

		console.log(response);
		console.log("\n");
	}

	return keypairs;
}

async function claimAirdrop(keypairs: Keypair[]) {
	const transaction = new Transaction();

	addComputeBudgetInstructions(transaction);

	for (let i = 0; i < keypairs.length; i++) {
		// Skip payer keypair
		if (keypairs[i].publicKey.toString() === payer.publicKey.toString()) {
			continue;
		}

		await addIdempotentInstruction(transaction, keypairs[i]);
		await addClaimInstruction(transaction, keypairs[i]);
	}

	if (transaction.instructions.length === 0) {
		console.log("No instructions to execute");
		return;
	}

	if (transaction.instructions.length < 3) {
		return "No claim instructions are present in the transaction";
	}

	const signature = await sendAndConfirmTransaction(
		connection,
		transaction,
		keypairs
	);

	return signature;
}

function addComputeBudgetInstructions(transaction: Transaction) {
	transaction.add(
		ComputeBudgetProgram.setComputeUnitLimit({
			units: 200_000,
		})
	);

	transaction.add(
		ComputeBudgetProgram.setComputeUnitPrice({
			microLamports: 0.01 * LAMPORTS_PER_SOL,
		})
	);
}

async function addClaimInstruction(transaction: Transaction, keypair: Keypair) {
	const ataPublicKey = await getAssociatedTokenAddressSync(keypair.publicKey);

	const instruction = new TransactionInstruction({
		programId: programId,
		keys: [
			{
				pubkey: new PublicKey("AQ84tYQnFLtdpCvXXRSXwYT7UzFNKVrCtqyiyxi8oDwE"),
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: new PublicKey("Cdc77Y1G1JyeXB6WrJJG7RBvUmNK4Mxp3ojGumRT5ovn"),
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: ataPublicKey,
				isSigner: false,
				isWritable: true,
			},
			{
				pubkey: new PublicKey("2EEw1A49utRqUsnYRYWtnpz2UQ7n7sJn8EEpdN2nKqWQ"),
				isSigner: false,
				isWritable: false,
			},
			{
				pubkey: keypair.publicKey,
				isSigner: true,
				isWritable: true,
			},
			{
				pubkey: new PublicKey("4rqc9TttM89RWaKKkkXJqYtGWws8LuMx9FBSW4DfSUMp"),
				isSigner: false, // On SolScan, this is true
				isWritable: false,
			},
			{
				pubkey: TOKEN_PROGRAM_ID,
				isSigner: false,
				isWritable: false,
			},
			{
				pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
				// pubkey: new PublicKey("Sysvar1nstructions1111111111111111111111111"),
				isSigner: false,
				isWritable: false,
			}
		],
		data: Buffer.from([
			0x3e, 0xe6, 0xd6, 0x1b, 0x98, 0x5f, 0xfe, 0x20,
			0x01, 0x00, 0x00, 0x07, 0xed, 0x46, 0x00, 0x40,
			0x51, 0xdd, 0x31, 0x00, 0x00, 0x00, 0x08, 0xaf,
			0x66, 0x15, 0x7
		])
	});

	transaction.add(instruction);
}

async function addIdempotentInstruction(
	transaction: Transaction,
	keypair: Keypair
) {
	const ataPublicKey = await getAssociatedTokenAddressSync(keypair.publicKey);

	const instruction = createAssociatedTokenAccountIdempotentInstruction(
		payer.publicKey, // change to keypair.publicKey if you want the wallet to pay for its own ATA
		ataPublicKey,
		keypair.publicKey,
		mint
	);

	transaction.add(instruction);
}

async function getAssociatedTokenAddressSync(publicKey: PublicKey) {
	const [ataPublicKey] = await PublicKey.findProgramAddressSync(
		[publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
		ASSOCIATED_TOKEN_PROGRAM_ID
	);

	return ataPublicKey;
}

main();
