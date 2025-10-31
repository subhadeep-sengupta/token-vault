import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenVault } from "../target/types/token_vault";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, TOKEN_2022_PROGRAM_ID, } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import wallet from "../../../phantom-wallet/id.json";

const main = async () => {
	const provider = anchor.AnchorProvider.env();
	anchor.setProvider(provider);

	const program = anchor.workspace.tokenVault as Program<TokenVault>;
	const targetAmount = 10_000_000_000;
	const depositAmount = 25_000_000_000;
	const user = Keypair.fromSecretKey(Uint8Array.from(wallet));
	const mint = new PublicKey("Gc59RHS7UybGB9NWPKZWyGypQU761vZoEQ1AJjgRXjBP");

	const ata = await getOrCreateAssociatedTokenAccount(
		provider.connection,
		user,
		mint,
		user.publicKey,
		false,
		"confirmed",
		undefined,
		TOKEN_2022_PROGRAM_ID
	);

	const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
		[Buffer.from("state"), user.publicKey.toBuffer(), mint.toBuffer()],
		program.programId
	);

	const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
		[Buffer.from("vault"), statePda.toBuffer(), mint.toBuffer()],
		program.programId
	);

	console.log(`StatePDA: ${statePda.toBase58()}`);
	console.log(`VaultPDA: ${vaultPda.toBase58()}`);

	console.log(`User ATA: ${ata.address.toBase58()}`);

	let vaultExists = false;

	try {
		await program.account.vaultState.fetch(statePda);
		vaultExists = true;
		console.log(`Vault already initialized. Ignore...`);
	} catch (e) {

		console.log(`Vault not found, creating ...`);
	}

	if (!vaultExists) {
		console.log(`Initializing Vault!...`);

		const initVaultTx = await program.methods.initialize(new anchor.BN(targetAmount)).accountsStrict({
			owner: user.publicKey,
			mint: mint,
			state: statePda,
			vault: vaultPda,
			tokenProgram: TOKEN_2022_PROGRAM_ID,
			systemProgram: anchor.web3.SystemProgram.programId
		})
			.signers([user])
			.rpc()

		console.log(`Initialized vault: ${initVaultTx}`);
	}

	console.log(`Depositing tokens...`)

	const depositTx = await program.methods.deposit(new anchor.BN(depositAmount)).accountsStrict({
		owner: user.publicKey,
		mint: mint,
		tokenAccount: ata.address,
		vault: vaultPda,
		state: statePda,
		tokenProgram: TOKEN_2022_PROGRAM_ID,
		systemProgram: anchor.web3.SystemProgram.programId,
		associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
	})
		.signers([user])
		.rpc()

	console.log(`Deposit tx: ${depositTx}`);

	const state = await program.account.vaultState.fetch(statePda);
	console.log(`Target amount: ${state.amount.toString()}`);
	console.log(`Token Mint: ${state.tokenMint.toBase58()}`);

	console.log(`Vault executed!`);
}

main();
