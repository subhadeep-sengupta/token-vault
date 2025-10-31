use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("HhZXkfKiLf4a7PJYbfzGggjdaTdD22azgHux2eJuaBm5");

#[program]
pub mod token_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64) -> Result<()> {
        let mint_pubkey = ctx.accounts.mint.key();

        ctx.accounts.initialize(amount, mint_pubkey, ctx.bumps)?;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        ctx.accounts.withdraw()?;

        Ok(())
    }
}
