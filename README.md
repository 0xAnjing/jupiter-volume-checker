# Pengu Claimer

# Pre-requisite

- [Deno](https://docs.deno.com/runtime/getting_started/installation/)

# Installation

1. Clone this repository
2. Run `deno intall`
3. Run `cp .env.example .env`
4. Paste your Payer wallet's private key into the `.env` file

# Usage

1. Run `cp ./wallets/private_keys.txt.example ./wallets/private_keys.txt`
2. Paste your wallets' private keys into `private_keys.txt` file

- One line for each wallet

3. Paste all json files containing your private keys into `./wallets` folder
4. Run `deno run -A main.ts`

# Note

- Already claimed wallets will fail the whole transaction
- Payer wallet is not included in the list of wallets to claim
- Ensure that the payer wallet has enough SOL to pay for the transaction fees

## Debugging

Error: `"Transaction simulation failed: Blockhash not found"`

Solution: try again after a few seconds

Reason: The blockhash is not yet available
