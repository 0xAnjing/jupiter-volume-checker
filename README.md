# Jupiter Volume Checker

# Pre-requisite

- [Deno](https://docs.deno.com/runtime/getting_started/installation/)
- [Dune API key](https://dune.com/settings/api)

# Installation

1. Clone this repository
2. Run `deno intall`
3. Run `cp .env.example .env`
4. Get your API key from Dune and paste it into the `.env` file

# Usage

1. Run `cp ./wallets/addresses.txt.example ./wallets/addresses.txt`
2. Paste your wallets' public keys into `addresses.txt` file

- One line for each wallet

3. Paste all json files containing your private keys into `./wallets` folder
4. Run `deno run -A main.ts`
5. Check the `./output/result.json` folder for the generated report (you may need to format the json file)
