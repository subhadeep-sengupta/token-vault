import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenVault } from "../target/types/token_vault";
import { expect } from "chai";
import { Account, getOrCreateAssociatedTokenAccount, getAccount, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, mintTo } from "@solana/spl-token";
import { BN } from "bn.js";
import { Keypair } from "@solana/web3.js";
import wallet from "../../../phantom-wallet/id.json"
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("token-vault", () => {
	// Configure the client to use the local cluster.
	const provider = anchor.AnchorProvider.env();
	anchor.setProvider(provider);

	const program = anchor.workspace.tokenVault as Program<TokenVault>;

	let user: anchor.web3.Keypair;
	let mint: anchor.web3.PublicKey;
	let vaultStatePda: anchor.web3.PublicKey;
	let vaultPda: anchor.web3.PublicKey;
	let userAta: Account;

	const targetAmount = 15_000_000_000;
	const depositAmount = 20_000_000_000;
	const mintAmount = 45_000_000_000;

	before(async () => {
		user = Keypair.fromSecretKey(Uint8Array.from(wallet));

		const airdropTransactio = await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
		await provider.connection.confirmTransaction(airdropTransactio, "confirmed");
		console.log(`${user.publicKey.toBase58()}, ${airdropTransactio}`)

		mint = await createMint(
			provider.connection,
			user,
			user.publicKey,
			user.publicKey,
			9
		);


		[vaultStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
			[Buffer.from("state"), user.publicKey.toBuffer(), mint.toBuffer()],
			program.programId
		);

		[vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
			[Buffer.from("vault"), vaultStatePda.toBuffer(), mint.toBuffer()],
			program.programId
		);

		userAta = await getOrCreateAssociatedTokenAccount(
			provider.connection,
			user,
			mint,
			user.publicKey,
		);
		console.log("User:", user.publicKey.toBase58());
		console.log("Mint:", mint.toBase58());
		console.log("Vault State PDA:", vaultStatePda.toBase58());
		console.log("Vault PDA:", vaultPda.toBase58());

		await mintTo(
			provider.connection,
			user,
			mint,
			userAta.address,
			user,
			mintAmount
		);

	});

	it("Initializes vault correctly", async () => {
		const tx = await program.methods
			.initialize(new anchor.BN(targetAmount))
			.accountsStrict({
				owner: user.publicKey,
				mint: mint,
				state: vaultStatePda,
				vault: vaultPda,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: anchor.web3.SystemProgram.programId,
			})
			.signers([user])
			.rpc();

		console.log("Initialize Tx:", tx);

		// Validate vault state account values
		const vaultState = await program.account.vaultState.fetch(vaultStatePda);
		const vaultAccount = await getAccount(provider.connection, vaultPda);

		expect(vaultState.amount.toNumber()).to.equal(targetAmount);
		expect(vaultState.tokenMint.toBase58()).to.equal(mint.toBase58());
		expect(new BN(vaultAccount.amount.toString()).toNumber()).to.equal(0);
		expect(vaultAccount.mint.toBase58()).to.equal(mint.toBase58());
	});

	it("Allows deposits to vault", async () => {
		const userBalanceBefore = await getAccount(provider.connection, userAta.address);

		const tx = await program.methods
			.deposit(new anchor.BN(depositAmount))
			.accountsStrict({
				owner: user.publicKey,
				mint: mint,
				tokenAccount: userAta.address,
				state: vaultStatePda,
				vault: vaultPda,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: anchor.web3.SystemProgram.programId,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			})
			.signers([user])
			.rpc();

		console.log("Deposit Tx:", tx);

		const vaultAccount = await getAccount(provider.connection, vaultPda);
		const userAccount = await getAccount(provider.connection, userAta.address);

		expect(new BN(vaultAccount.amount.toString()).toNumber()).to.equal(depositAmount);
		expect(
			new BN(userAccount.amount.toString()).toNumber()
		).to.equal(
			new BN(userBalanceBefore.amount.toString()).sub(new BN(depositAmount.toString())).toNumber()
		);
	});

	it("Rejects zero deposit amount", async () => {
		try {
			await program.methods
				.deposit(new anchor.BN(0))
				.accountsStrict({
					owner: user.publicKey,
					mint: mint,
					tokenAccount: userAta.address,
					state: vaultStatePda,
					vault: vaultPda,
					tokenProgram: TOKEN_PROGRAM_ID,
					systemProgram: anchor.web3.SystemProgram.programId,
					associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
				})
				.signers([user])
				.rpc();
			expect.fail("Deposit of zero amount should fail");
		} catch (error) {
			const anchorError = error as anchor.AnchorError;
			expect(anchorError.error.errorCode.code).to.equal("InvalidDepositAmount");
		}
	});

	it("Allows withdrawals from vault", async () => {
		const vaultBalanceBefore = await getAccount(provider.connection, vaultPda);
		const userBalanceBefore = await getAccount(provider.connection, userAta.address);

		const tx = await program.methods
			.withdraw()
			.accountsStrict({
				owner: user.publicKey,
				mint: mint,
				associateTokenAccount: userAta.address,
				state: vaultStatePda,
				vault: vaultPda,
				tokenProgram: TOKEN_PROGRAM_ID,
				systemProgram: anchor.web3.SystemProgram.programId,
				associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			})
			.signers([user])
			.rpc();

		console.log("Withdraw Tx:", tx);

		const vaultAccount = await getAccount(provider.connection, vaultPda);
		const userAccount = await getAccount(provider.connection, userAta.address);

		expect(new BN(vaultAccount.amount.toString()).toNumber()).to.equal(0);
		expect(
			new BN(userAccount.amount.toString()).toNumber()
		).to.equal(
			new BN(userBalanceBefore.amount.toString()).add(new BN(vaultBalanceBefore.amount.toString())).toNumber()
		);
	});

});
