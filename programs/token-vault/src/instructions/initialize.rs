use anchor_lang::prelude::*;

use crate::state::VaultState;

use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = owner,
        space = VaultState::INIT_SPACE + 8,
        seeds = [b"state".as_ref(), owner.key().as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub state: Account<'info, VaultState>,

    #[account(
        init,
        payer = owner,
        seeds = [b"vault".as_ref(), state.key().as_ref(), mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = state,
        token::token_program  = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, amount: u64, mint: Pubkey, bumps: InitializeBumps) -> Result<()> {
        self.state.set_inner(VaultState {
            vault_bump: bumps.vault,
            state_bump: bumps.state,
            amount,
            token_mint: mint,
        });

        Ok(())
    }
}
